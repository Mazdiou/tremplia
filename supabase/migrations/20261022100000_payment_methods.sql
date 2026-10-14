-- Migration : payment_methods
-- Moyens de paiement retenus : espèces, CCP / BaridiMob, carte (CIB /
-- Edahabia). Virement et chèque ne sont plus proposés. NOT VALID : la règle
-- vaut pour les nouveaux paiements ; un paiement déjà enregistré avec un
-- ancien moyen reste tel quel (historique).

alter table public.case_payments
  drop constraint case_payments_method_check;

alter table public.case_payments
  add constraint case_payments_method_check
  check (method in ('cash', 'ccp', 'card')) not valid;
