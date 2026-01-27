import { NextResponse } from "next/server"
import { EnvServer } from "@/libs/EnvServer"

export function GET() {
  return NextResponse.json({ 
    hasSupabaseUrl: !!EnvServer.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!EnvServer.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!EnvServer.SUPABASE_SERVICE_ROLE_KEY,
    urlPrefix: EnvServer.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)
  })
}
