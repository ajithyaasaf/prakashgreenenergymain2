import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get the Firebase auth token
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.log("FRONTEND AUTH: No current user, cannot get token");
    throw new Error("User not authenticated");
  }
  
  const token = await currentUser.getIdToken();
  console.log("FRONTEND AUTH: Token obtained for user", currentUser.uid, "token length:", token.length);
  
  // For GET requests, append data as query parameters if provided
  let finalUrl = url;
  const headers: Record<string, string> = {
    ...(data && method !== 'GET' ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
  
  const options: RequestInit = {
    method,
    headers,
    credentials: "include",
  };
  
  // Only add body for non-GET requests
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  } else if (data && method === 'GET') {
    // Convert data to query params for GET requests
    const params = new URLSearchParams();
    Object.entries(data as Record<string, any>).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    finalUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
  }
  
  const res = await fetch(finalUrl, options);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get the Firebase auth token
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    
    const headers: Record<string, string> = {
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };
    
    const res = await fetch(queryKey[0] as string, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
