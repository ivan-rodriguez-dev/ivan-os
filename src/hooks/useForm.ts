import { useCallback, useState, type FormEvent } from 'react';
import { hasErrors, validate, type Errors, type Rules } from '@/lib/validation';

/** Form state with rule-based validation. Fields are strings/booleans as typed by the user. */
export function useForm<V extends object>(initial: V, rules: Rules<V>) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Errors<V>>({});

  const set = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** Wraps a submit handler: it only runs when every rule passes. */
  const submit = (onValid: (values: V) => void | Promise<void>) => (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values, rules);
    setErrors(found);
    if (!hasErrors(found)) void onValid(values);
  };

  return { values, errors, set, submit, setValues };
}
