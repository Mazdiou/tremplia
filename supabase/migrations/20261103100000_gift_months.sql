-- Migration : gift_months
-- « Offrir des mois » : l'administrateur prolonge l'abonnement d'une agence
-- sans paiement (partenaire, geste commercial). C'est une ligne de
-- platform_payments comme une autre, de moyen « gift » et de montant 0 :
-- même calcul de la fin, même historique, même annulation. Un paiement réel
-- garde un montant strictement positif.

alter table public.platform_payments
  drop constraint platform_payments_amount_check,
  drop constraint platform_payments_method_check;

alter table public.platform_payments
  add constraint platform_payments_method_check
    check (method in ('cash', 'ccp', 'baridimob', 'gift')),
  add constraint platform_payments_amount_check
    check (public.is_valid_amount(amount)
           and case when method = 'gift' then amount = 0 else amount > 0 end);
