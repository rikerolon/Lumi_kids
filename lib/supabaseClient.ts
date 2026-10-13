import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// createClient espera la URL base del proyecto; si viene con una ruta
// (p. ej. ".../rest/v1/") las llamadas de auth terminan en un 404.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/^(https?:\/\/[^/]+).*$/, "$1");
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// En el render estático de web no existe window, y AsyncStorage falla al leer.
const isServer = Platform.OS === "web" && typeof window === "undefined";

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
