export default function LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">KalyanMatch Admin</h1>
          <p className="text-muted-foreground">Enter your credentials to access the panel</p>
        </div>
        {/* We will integrate actual Supabase auth here later */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="m@example.com" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2 w-full">
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
