// Centralized API layer for VariomeX frontend
// Uses native fetch and returns typed JSON. All requests use cache: 'no-store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type DiseaseVariant = {
  chr: string;
  pos: number;
  ref?: string;
  alt?: string;
  disease: string;
  significance?: string;
};

export type MutationResult = {
  disease: string;
  significance?: string;
};

export type CheckDiseaseResult = {
  has_mutations: boolean;
  matched_diseases: string[];
  mutations?: MutationResult[];
};

export type ZKPMutationResult = {
  exists: boolean;
  proof: string | null;
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function queryDisease(disease: string): Promise<DiseaseVariant[]> {
  const url = `${BASE_URL}/query/disease?disease=${encodeURIComponent(disease)}`;
  const res = await fetch(url, { cache: "no-store" });
  return handleResponse<DiseaseVariant[]>(res);
}

export const checkGenomeDisease = async (genomeId: string | number, disease: string) => {
  const idPath = encodeURIComponent(String(genomeId));
  const url = `${BASE_URL}/query/genome/${idPath}/check-disease?disease=${encodeURIComponent(disease)}`;
  const res = await fetch(url, { cache: "no-store" });

  const data = await res.json();

  console.log("API RESPONSE:", data); // 🔥 DEBUG

  // Defensive backend types
  type BackendAnnotation = { [k: string]: unknown };
  type BackendMatch = { annotations?: BackendAnnotation[] };

  // transform backend → frontend format
  const matched_diseases: string[] = [];
  const mutations: MutationResult[] = [];

  if (Array.isArray(data.matches)) {
    const matches = data.matches as BackendMatch[];
    for (const m of matches) {
      if (Array.isArray(m.annotations) && m.annotations.length > 0) {
        const ann0 = m.annotations[0];
        if (ann0 && typeof ann0 === "object") {
          const disease = (ann0 as Record<string, unknown>)["disease"];
          if (typeof disease === "string") matched_diseases.push(disease);
        }
      }

      if (Array.isArray(m.annotations)) {
        for (const a of m.annotations) {
          if (a && typeof a === "object") {
            const disease = (a as Record<string, unknown>)["disease"];
            const significance = (a as Record<string, unknown>)["significance"];
            mutations.push({
              disease: typeof disease === "string" ? disease : "",
              significance: typeof significance === "string" ? significance : undefined,
            });
          }
        }
      }
    }
  }

  return {
    has_mutations: !!data.found,
    matched_diseases,
    mutations,
  } as CheckDiseaseResult;
};

export async function queryMutation(params: { chr: string; pos: number | string; ref: string; alt: string }): Promise<MutationResult> {
  const { chr, pos, ref, alt } = params;
  const url = `${BASE_URL}/query/mutation?chr=${encodeURIComponent(String(chr))}&pos=${encodeURIComponent(String(pos))}&ref=${encodeURIComponent(ref)}&alt=${encodeURIComponent(alt)}`;
  const res = await fetch(url, { cache: "no-store" });
  return handleResponse<MutationResult>(res);
}

export async function zkpMutation(chr: string, pos: number | string, ref: string, alt: string): Promise<ZKPMutationResult> {
  const url = `${BASE_URL}/query/zkp-mutation?chr=${encodeURIComponent(String(chr))}&pos=${encodeURIComponent(String(pos))}&ref=${encodeURIComponent(ref)}&alt=${encodeURIComponent(alt)}`;
  const res = await fetch(url, { cache: "no-store" });
  return handleResponse<ZKPMutationResult>(res);
}

const api = {
  queryDisease,
  checkGenomeDisease,
  queryMutation,
  zkpMutation,
};

export default api;
