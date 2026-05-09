import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Loader2,
  Search,
  Trash2,
  FileCheck,
  Package,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { ProjectDeliverables } from '@/lib/types';

interface Props {
  projectId: string;
}

const TIPOS_TRAMITE = [
  { value: 'licencia_obra_menor', label: 'Licencia obra menor' },
  { value: 'licencia_obra_mayor', label: 'Licencia obra mayor' },
  { value: 'comunicacion_previa', label: 'Comunicacion previa' },
  { value: 'declaracion_responsable', label: 'Declaracion responsable' },
  { value: 'iee', label: 'Tramite IEE' },
  { value: 'cambio_uso', label: 'Cambio de uso' },
  { value: 'primera_ocupacion', label: 'Primera ocupacion' },
];

const MUNICIPIOS = ['', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];

export function ProjectDeliverablesPanel({ projectId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['project-deliverables', projectId];

  const { data, isLoading, refetch } = useQuery<ProjectDeliverables>({
    queryKey,
    queryFn: () => api.projectDeliverables(projectId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['timeline', projectId] });
  };

  if (isLoading) {
    return (
      <div className="foxhole-card p-4 flex items-center gap-2 text-foxhole-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando entregables...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="foxhole-stencil text-xs">Tramites y subvenciones (Fase B)</h2>
        <button
          onClick={() => refetch()}
          className="text-[10px] font-mono text-foxhole-muted hover:text-foxhole-bone flex items-center gap-1"
          title="Refrescar todos"
        >
          <RefreshCw className="w-3 h-3" />
          refrescar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <GrantsCard projectId={projectId} data={data?.grants ?? null} onUpdate={invalidate} />
        <RCDCard projectId={projectId} data={data?.rcd} onUpdate={invalidate} />
        <IEECard projectId={projectId} data={data?.iee} onUpdate={invalidate} />
        <TelematicCard projectId={projectId} data={data?.telematic ?? null} onUpdate={invalidate} />
      </div>
    </div>
  );
}

// ===========================================================
// Card 1 — Subvenciones (agent_grants_finder)
// ===========================================================
function GrantsCard({
  projectId,
  data,
  onUpdate,
}: {
  projectId: string;
  data: ProjectDeliverables['grants'];
  onUpdate: () => void;
}) {
  const run = useMutation({
    mutationFn: () => api.runGrantsFinder(projectId),
    onSuccess: onUpdate,
  });
  const recos = data?.output?.recomendaciones ?? [];
  const ahorro = data?.output?.ahorro_total_acumulable_eur ?? 0;

  return (
    <div className="foxhole-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-foxhole-tan" />
          <h3 className="text-sm font-display font-semibold">Subvenciones</h3>
        </div>
        {data && (
          <span className="text-[10px] font-mono text-foxhole-muted">
            {new Date(data.finished_at).toLocaleDateString('es-ES')}
          </span>
        )}
      </div>

      {data ? (
        <>
          <div className="text-xs">
            <span className="text-foxhole-muted">Ahorro acumulable estimado:</span>{' '}
            <span className="font-mono text-foxhole-state-working font-semibold">
              {ahorro.toLocaleString('es-ES')} EUR
            </span>{' '}
            <span className="text-foxhole-muted">en {recos.length} subvenciones</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {recos.slice(0, 5).map((r) => (
              <div key={r.grant_id} className="text-[11px] border-l-2 border-foxhole-border pl-2">
                <div className="font-medium text-foxhole-bone">{r.nombre}</div>
                <div className="text-foxhole-muted">
                  {r.organismo} · {r.ahorro_estimado_eur.toLocaleString('es-ES')} EUR (
                  {r.porcentaje_aplicable}%) · prob: {r.probabilidad_aprobacion}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-foxhole-muted italic">
          No analizado aun. Ejecuta para obtener el TOP 5 de subvenciones aplicables.
        </p>
      )}

      <button
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="foxhole-btn-primary text-xs flex items-center justify-center gap-1.5 py-1.5"
      >
        {run.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        {data ? 'Re-ejecutar' : 'Buscar subvenciones'}
      </button>
      {run.error && <ErrorLine error={run.error} />}
    </div>
  );
}

// ===========================================================
// Card 2 — Residuos (agent_rcd) - draft + approve
// ===========================================================
function RCDCard({
  projectId,
  data,
  onUpdate,
}: {
  projectId: string;
  data: ProjectDeliverables['rcd'] | undefined;
  onUpdate: () => void;
}) {
  const approved = data?.approved ?? null;
  const draft = data?.draft ?? null;
  const showing = approved || draft;

  const generate = useMutation({
    mutationFn: () => api.runRCD(projectId),
    onSuccess: onUpdate,
  });
  const approveDraft = useMutation({
    mutationFn: (draftId: string) => api.approveRCD(draftId),
    onSuccess: onUpdate,
  });

  return (
    <div className="foxhole-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-foxhole-tan" />
          <h3 className="text-sm font-display font-semibold">Estudio Residuos (RCD)</h3>
        </div>
        {showing && (
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
              approved
                ? 'text-foxhole-state-working bg-foxhole-state-working/10'
                : 'text-foxhole-state-waiting bg-foxhole-state-waiting/10'
            }`}
          >
            {approved ? 'aprobado' : 'draft'}
          </span>
        )}
      </div>

      {showing ? (
        <div className="text-xs flex flex-col gap-1">
          <div>
            <span className="text-foxhole-muted">Total residuos:</span>{' '}
            <span className="font-mono">{showing.total_toneladas} Tn</span>
          </div>
          {showing.coste_gestion_eur && (
            <div>
              <span className="text-foxhole-muted">Coste gestion estimado:</span>{' '}
              <span className="font-mono">{showing.coste_gestion_eur.toLocaleString('es-ES')} EUR</span>
            </div>
          )}
          {(showing.alertas_peligrosos?.length ?? 0) > 0 && (
            <div className="flex items-start gap-1 text-foxhole-state-failed">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{showing.alertas_peligrosos!.length} alertas peligrosos detectadas</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-foxhole-muted italic">
          Sin estudio. RD 105/2008 obligatorio para licencia.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="foxhole-btn-primary text-xs flex-1 flex items-center justify-center gap-1.5 py-1.5"
        >
          {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {approved ? 'Re-generar' : draft ? 'Re-generar' : 'Generar'}
        </button>
        {draft && !approved && (
          <button
            onClick={() => approveDraft.mutate(draft.draft_id!)}
            disabled={approveDraft.isPending}
            className="text-xs flex items-center justify-center gap-1.5 py-1.5 px-3 border border-foxhole-state-working/40 text-foxhole-state-working rounded hover:bg-foxhole-state-working/10"
          >
            {approveDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Aprobar
          </button>
        )}
      </div>
      {(generate.error || approveDraft.error) && <ErrorLine error={generate.error || approveDraft.error} />}
    </div>
  );
}

// ===========================================================
// Card 3 — IEE (agent_iee) - draft + approve
// ===========================================================
function IEECard({
  projectId,
  data,
  onUpdate,
}: {
  projectId: string;
  data: ProjectDeliverables['iee'] | undefined;
  onUpdate: () => void;
}) {
  const approved = data?.approved ?? null;
  const draft = data?.draft ?? null;
  const showing = approved || draft;
  const [anioInput, setAnioInput] = useState('');

  const generate = useMutation({
    mutationFn: () => {
      const opts = anioInput ? { anio_construccion: Number(anioInput) } : undefined;
      return api.runIEE(projectId, opts);
    },
    onSuccess: onUpdate,
  });
  const approveDraft = useMutation({
    mutationFn: (draftId: string) => api.approveIEE(draftId),
    onSuccess: onUpdate,
  });

  return (
    <div className="foxhole-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-foxhole-tan" />
          <h3 className="text-sm font-display font-semibold">Informe Evaluacion Edificios</h3>
        </div>
        {showing && (
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
              approved
                ? 'text-foxhole-state-working bg-foxhole-state-working/10'
                : 'text-foxhole-state-waiting bg-foxhole-state-waiting/10'
            }`}
          >
            {approved ? 'aprobado' : 'draft'}
          </span>
        )}
      </div>

      {showing ? (
        <div className="text-xs flex flex-col gap-1">
          <div>
            <span className="text-foxhole-muted">Calificacion global:</span>{' '}
            <span className="font-mono text-base font-bold text-foxhole-tan">
              {showing.calificacion_global}
            </span>
          </div>
          <div>
            <span className="text-foxhole-muted">Conservacion:</span>{' '}
            <span>{showing.estado_conservacion}</span>
          </div>
          <div>
            <span className="text-foxhole-muted">Accesibilidad:</span>{' '}
            <span>{showing.condiciones_accesibilidad}</span>
          </div>
          <div>
            <span className="text-foxhole-muted">Energetica:</span>{' '}
            <span>{showing.eficiencia_energetica}</span>
          </div>
          {(showing.recomendaciones?.length ?? 0) > 0 && (
            <div className="text-[10px] text-foxhole-muted">
              {showing.recomendaciones!.length} recomendaciones priorizadas
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-[11px] text-foxhole-muted italic">
            Sin IEE. Obligatorio edificios &gt;50 anos en grandes municipios.
          </p>
          <input
            type="number"
            value={anioInput}
            onChange={(e) => setAnioInput(e.target.value)}
            placeholder="anio construccion (ej. 1965)"
            className="bg-foxhole-surface border border-foxhole-border rounded px-2 py-1 text-xs"
          />
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="foxhole-btn-primary text-xs flex-1 flex items-center justify-center gap-1.5 py-1.5"
        >
          {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
          {approved ? 'Re-generar' : draft ? 'Re-generar' : 'Generar IEE'}
        </button>
        {draft && !approved && (
          <button
            onClick={() => approveDraft.mutate(draft.draft_id!)}
            disabled={approveDraft.isPending}
            className="text-xs flex items-center justify-center gap-1.5 py-1.5 px-3 border border-foxhole-state-working/40 text-foxhole-state-working rounded hover:bg-foxhole-state-working/10"
          >
            {approveDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Aprobar
          </button>
        )}
      </div>
      {(generate.error || approveDraft.error) && <ErrorLine error={generate.error || approveDraft.error} />}
    </div>
  );
}

// ===========================================================
// Card 4 — Tramitacion (agent_telematic_filing)
// ===========================================================
function TelematicCard({
  projectId,
  data,
  onUpdate,
}: {
  projectId: string;
  data: ProjectDeliverables['telematic'];
  onUpdate: () => void;
}) {
  const [tipo, setTipo] = useState('licencia_obra_menor');
  const [municipio, setMunicipio] = useState('Madrid');
  const run = useMutation({
    mutationFn: () => api.runTelematicFiling(projectId, tipo, municipio || undefined),
    onSuccess: onUpdate,
  });

  const lastEstado = data?.output?.estado;
  const lastValidados = data?.output?.docs_validados_count ?? 0;
  const lastFaltantes = data?.output?.docs_faltantes_count ?? 0;

  return (
    <div className="foxhole-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-foxhole-tan" />
          <h3 className="text-sm font-display font-semibold">Expediente sede electronica</h3>
        </div>
        {data && (
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
              lastEstado === 'listo'
                ? 'text-foxhole-state-working bg-foxhole-state-working/10'
                : 'text-foxhole-state-waiting bg-foxhole-state-waiting/10'
            }`}
          >
            {lastEstado}
          </span>
        )}
      </div>

      {data ? (
        <div className="text-xs flex flex-col gap-1">
          <div>
            <span className="text-foxhole-muted">Tramite:</span>{' '}
            <span className="font-mono">{data.input?.municipio} · {data.input?.tipo_tramite?.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-foxhole-muted">Docs validados:</span>{' '}
            <span className="font-mono text-foxhole-state-working">{lastValidados}</span>
            {' · '}
            <span className="text-foxhole-muted">faltantes:</span>{' '}
            <span className={`font-mono ${lastFaltantes > 0 ? 'text-foxhole-state-failed' : 'text-foxhole-state-working'}`}>
              {lastFaltantes}
            </span>
          </div>
          {data.output?.peso_estimado_mb && (
            <div>
              <span className="text-foxhole-muted">Peso estimado ZIP:</span>{' '}
              <span className="font-mono">{data.output.peso_estimado_mb} MB</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-foxhole-muted italic">
          Empaqueta documentos para sede electronica. ArquitAI prepara el ZIP, el tecnico firma y sube.
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
          className="bg-foxhole-surface border border-foxhole-border rounded px-2 py-1 text-xs"
        >
          {MUNICIPIOS.map((m) => (
            <option key={m} value={m}>
              {m || '(automatico)'}
            </option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="bg-foxhole-surface border border-foxhole-border rounded px-2 py-1 text-xs"
        >
          {TIPOS_TRAMITE.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="foxhole-btn-primary text-xs flex items-center justify-center gap-1.5 py-1.5"
      >
        {run.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
        Preparar expediente
      </button>
      {run.error && <ErrorLine error={run.error} />}
    </div>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  return (
    <div className="text-[10px] text-foxhole-state-failed flex items-start gap-1">
      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{String((error as Error)?.message || error)}</span>
    </div>
  );
}
