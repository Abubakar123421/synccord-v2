import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// supabase global is loaded from the CDN <script> in index.html
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

export default sb;
