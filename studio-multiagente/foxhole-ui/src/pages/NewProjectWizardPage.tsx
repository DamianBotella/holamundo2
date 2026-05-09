import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  CreateProjectPayload,
  CreateProjectResponse,
  ProjectType,
  PropertyType,
  Urgency,
} from '@/lib/types';

interface Props {
  onBack: () => void;
  onCreated: (projectId: string) => void;
}

type WizardData = {
  // Paso 1 — Cliente
  client_name: string;
  client_email: string;
  client_phone: string;
  // Paso 2 — Reforma
  project_name: string;
  project_type: ProjectType;
  property_type: PropertyType | '';
  property_area_m2: string;
  budget_target: string;
  budget_flexible: boolean;
  location_address: string;
  location_city: string;
  location_province: string;
  urgency: Urgency;
  // Paso 3 — Notas arquitecto
  notes: string;
};

const INITIAL: WizardData = {
  client_name: '',
  client_email: '',
  client_phone: '',
  project_name: '',
  project_type: 'reforma_integral',
  property_type: '',
  property_area_m2: '',
  budget_target: '',
  budget_flexible: false,
  location_address: '',
  location_city: '',
  location_province: '',
  urgency: 'normal',
  notes: '',
};

const PROJECT_TYPES: Array<{ value: ProjectType; label: string }> = [
  { value: 'reforma_integral', label: 'Reforma integral' },
  { value: 'redistribucion', label: 'Redistribucion' },
  { value: 'cambio_uso', label: 'Cambio de uso' },
  { value: 'adecuacion', label: 'Adecuacion' },
  { value: 'apoyo_tecnico', label: 'Apoyo tecnico' },
  { value: 'otro', label: 'Otro' },
];

const PROPERTY_TYPES: Array<{ value: PropertyType; label: string }> = [
  { value: 'piso', label: 'Piso' },
  { value: 'casa', label: 'Casa' },
  { value: 'local', label: 'Local' },
  { value: 'atico', label: 'Atico' },
  { value: 'bajo', label: 'Bajo' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'otro', label: 'Otro' },
];

const URGENCIES: Array<{ value: Urgency; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateStep(step: 1 | 2 | 3, data: WizardData): string | null {
  if (step === 1) {
    if (!data.client_name.trim()) return 'Nombre del cliente obligatorio';
    if (data.client_email && !EMAIL_RE.test(data.client_email.trim())) {
      return 'Email del cliente con formato invalido';
    }
    return null;
  }
  if (step === 2) {
    if (!data.project_name.trim()) return 'Nombre del proyecto obligatorio';
    if (data.property_area_m2 && Number(data.property_area_m2) <= 0) {
      return 'Superficie debe ser mayor que 0';
    }
    if (data.budget_target && Number(data.budget_target) <= 0) {
      return 'Presupuesto debe ser mayor que 0';
    }
    return null;
  }
  return null;
}

function buildPayload(d: WizardData): CreateProjectPayload {
  return {
    client_name: d.client_name.trim(),
    client_email: d.client_email.trim() || null,
    client_phone: d.client_phone.trim() || null,
    project_name: d.project_name.trim(),
    project_type: d.project_type,
    location_address: d.location_address.trim() || null,
    location_city: d.location_city.trim() || null,
    location_province: d.location_province.trim() || null,
    property_type: d.property_type || null,
    property_area_m2: d.property_area_m2 ? Number(d.property_area_m2) : null,
    budget_target: d.budget_target ? Number(d.budget_target) : null,
    budget_flexible: d.budget_flexible,
    urgency: d.urgency,
    notes: d.notes.trim() || null,
  };
}

export function NewProjectWizardPage({ onBack, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [stepError, setStepError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation<CreateProjectResponse, Error, CreateProjectPayload>({
    mutationFn: api.createProject,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      onCreated(res.project_id);
    },
  });

  const update = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setStepError(null);
  };

  const handleNext = () => {
    const err = validateStep(step, data);
    if (err) {
      setStepError(err);
      return;
    }
    if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handlePrev = () => {
    setStepError(null);
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
  };

  const handleSubmit = () => {
    const err = validateStep(3, data);
    if (err) {
      setStepError(err);
      return;
    }
    mutation.mutate(buildPayload(data));
  };

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-foxhole-muted hover:text-foxhole-bone w-fit"
      >
        <ArrowLeft className="w-3 h-3" />
        Volver al dashboard
      </button>

      <header className="flex flex-col gap-1">
        <h1 className="foxhole-stencil text-base">Nuevo proyecto</h1>
        <p className="text-xs text-foxhole-muted">
          Completa los 3 pasos. Al crear se disparara automaticamente el briefing del agente recepcionista.
        </p>
      </header>

      <Stepper current={step} />

      <div className="foxhole-card p-5 flex flex-col gap-4">
        {step === 1 && <Step1Cliente data={data} update={update} />}
        {step === 2 && <Step2Reforma data={data} update={update} />}
        {step === 3 && <Step3Notas data={data} update={update} />}

        {stepError && (
          <div className="flex items-start gap-2 text-xs text-foxhole-state-failed bg-foxhole-state-failed/10 border border-foxhole-state-failed/40 rounded px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{stepError}</span>
          </div>
        )}

        {mutation.error && (
          <div className="flex items-start gap-2 text-xs text-foxhole-state-failed bg-foxhole-state-failed/10 border border-foxhole-state-failed/40 rounded px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Error al crear: {String(mutation.error.message || mutation.error)}</span>
          </div>
        )}
      </div>

      <footer className="flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={step === 1 || mutation.isPending}
          className="flex items-center gap-1 px-3 py-2 text-sm border border-foxhole-border rounded text-foxhole-muted hover:text-foxhole-bone hover:border-foxhole-border-strong disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Anterior
        </button>

        {step < 3 ? (
          <button
            onClick={handleNext}
            className="foxhole-btn-primary flex items-center gap-1 px-4 py-2 text-sm"
          >
            Siguiente
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="foxhole-btn-primary flex items-center gap-1 px-4 py-2 text-sm disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Crear proyecto
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  );
}

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Cliente' },
    { n: 2, label: 'Reforma' },
    { n: 3, label: 'Notas' },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2 flex-1">
          <div
            className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono ${
              s.n < current
                ? 'bg-foxhole-state-working/30 border-foxhole-state-working text-foxhole-state-working'
                : s.n === current
                  ? 'bg-foxhole-tan/20 border-foxhole-tan text-foxhole-tan'
                  : 'border-foxhole-border text-foxhole-muted'
            }`}
          >
            {s.n < current ? <Check className="w-3.5 h-3.5" /> : s.n}
          </div>
          <span
            className={`text-xs font-mono uppercase tracking-wider ${
              s.n === current ? 'text-foxhole-bone' : 'text-foxhole-muted'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px bg-foxhole-border" />
          )}
        </div>
      ))}
    </div>
  );
}

interface StepProps {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
}

function Step1Cliente({ data, update }: StepProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Nombre del cliente *" full>
        <input
          type="text"
          value={data.client_name}
          onChange={(e) => update('client_name', e.target.value)}
          autoFocus
          maxLength={120}
          className={inputCls}
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={data.client_email}
          onChange={(e) => update('client_email', e.target.value)}
          maxLength={200}
          className={inputCls}
        />
      </Field>
      <Field label="Telefono">
        <input
          type="tel"
          value={data.client_phone}
          onChange={(e) => update('client_phone', e.target.value)}
          maxLength={30}
          className={inputCls}
        />
      </Field>
    </div>
  );
}

function Step2Reforma({ data, update }: StepProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Nombre del proyecto *" full>
        <input
          type="text"
          value={data.project_name}
          onChange={(e) => update('project_name', e.target.value)}
          placeholder="Ej. Reforma piso Embajadores"
          maxLength={150}
          className={inputCls}
        />
      </Field>
      <Field label="Tipo de obra *">
        <select
          value={data.project_type}
          onChange={(e) => update('project_type', e.target.value as ProjectType)}
          className={inputCls}
        >
          {PROJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo de inmueble">
        <select
          value={data.property_type}
          onChange={(e) => update('property_type', e.target.value as PropertyType | '')}
          className={inputCls}
        >
          <option value="">— Sin especificar —</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Direccion">
        <input
          type="text"
          value={data.location_address}
          onChange={(e) => update('location_address', e.target.value)}
          placeholder="Calle y numero"
          maxLength={200}
          className={inputCls}
        />
      </Field>
      <Field label="Ciudad">
        <input
          type="text"
          value={data.location_city}
          onChange={(e) => update('location_city', e.target.value)}
          maxLength={100}
          className={inputCls}
        />
      </Field>
      <Field label="Provincia">
        <input
          type="text"
          value={data.location_province}
          onChange={(e) => update('location_province', e.target.value)}
          maxLength={100}
          className={inputCls}
        />
      </Field>
      <Field label="Superficie (m2)">
        <input
          type="number"
          min="0"
          step="0.5"
          value={data.property_area_m2}
          onChange={(e) => update('property_area_m2', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Presupuesto orientativo (EUR)">
        <input
          type="number"
          min="0"
          step="100"
          value={data.budget_target}
          onChange={(e) => update('budget_target', e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Urgencia">
        <select
          value={data.urgency}
          onChange={(e) => update('urgency', e.target.value as Urgency)}
          className={inputCls}
        >
          {URGENCIES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-foxhole-bone mt-2">
        <input
          type="checkbox"
          checked={data.budget_flexible}
          onChange={(e) => update('budget_flexible', e.target.checked)}
          className="accent-foxhole-tan"
        />
        Presupuesto flexible
      </label>
    </div>
  );
}

function Step3Notas({ data, update }: StepProps) {
  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Notas del arquitecto"
        full
        hint="Observaciones, preferencias del cliente, restricciones detectadas. El agente recepcionista usara este texto como entrada del briefing."
      >
        <textarea
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={10}
          maxLength={4000}
          placeholder="Cliente quiere abrir cocina al salon. Edificio de 1965, posibles tabiques de carga. Comprueba REBT y CTE DB-HE en cubierta..."
          className={`${inputCls} resize-y min-h-[160px] font-mono text-xs leading-relaxed`}
        />
      </Field>
      <p className="text-[10px] text-foxhole-muted text-right">
        {data.notes.length} / 4000
      </p>

      <div className="border-t border-foxhole-border pt-3 mt-2">
        <h3 className="foxhole-stencil text-[10px] mb-2">Resumen</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <SummaryRow label="Cliente" value={data.client_name} />
          <SummaryRow label="Proyecto" value={data.project_name} />
          <SummaryRow label="Tipo" value={data.project_type.replace(/_/g, ' ')} />
          <SummaryRow
            label="Inmueble"
            value={data.property_type ? `${data.property_type} · ${data.property_area_m2 || '?'} m2` : '—'}
          />
          <SummaryRow
            label="Ubicacion"
            value={[data.location_city, data.location_province].filter(Boolean).join(', ') || '—'}
          />
          <SummaryRow
            label="Presupuesto"
            value={data.budget_target ? `${Number(data.budget_target).toLocaleString('es-ES')} EUR${data.budget_flexible ? ' (flex)' : ''}` : '—'}
          />
        </dl>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? 'md:col-span-2' : ''}`}>
      <span className="text-foxhole-muted text-[10px] font-mono uppercase tracking-wider">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10px] text-foxhole-muted italic">{hint}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-foxhole-border/40 py-1">
      <span className="text-foxhole-muted font-mono text-[10px] uppercase tracking-wider">
        {label}
      </span>
      <span className="text-foxhole-bone truncate text-right">{value || '—'}</span>
    </div>
  );
}

const inputCls =
  'bg-foxhole-surface border border-foxhole-border rounded px-2.5 py-1.5 text-sm text-foxhole-bone focus:outline-none focus:border-foxhole-tan';
