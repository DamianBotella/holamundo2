import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/session';

export function LoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen bg-foxhole-bg flex items-center justify-center p-4">
      <div className="foxhole-card w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="text-center">
          <h1 className="text-xl font-medium tracking-tight">ArquitAI</h1>
          <p className="text-xs font-mono uppercase tracking-wider text-foxhole-muted mt-1">
            Foxhole // acceso operativo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foxhole-muted text-xs font-mono uppercase tracking-wider">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="bg-foxhole-surface border border-foxhole-border rounded-md px-3 py-2 focus:outline-none focus:border-foxhole-accent"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foxhole-muted text-xs font-mono uppercase tracking-wider">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-foxhole-surface border border-foxhole-border rounded-md px-3 py-2 focus:outline-none focus:border-foxhole-accent"
            />
          </label>

          {error && (
            <div className="text-sm text-foxhole-warning bg-foxhole-surface border border-foxhole-warning/40 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 bg-foxhole-accent text-foxhole-bg font-medium rounded-md py-2 hover:bg-foxhole-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
