> Mise à jour du 6 novembre : pour les rappels de paiement, utilisez les deux nouveaux brouillons de [ce complément](whatsapp-payment-reminder-templates.fr.md). Le n° 30 mentionne des arriérés et ne doit pas être raccordé tel quel à WhatsApp. Les nouveaux rappels fonctionnent actuellement en SMS.

# GM Fleet — modèles de notification

Pour chaque modèle : copier le **nom**, choisir **Français (`fr`)**, puis copier le **contenu**. Les valeurs entre `{{1}}` et `{{2}}` sont des variables ; utiliser les valeurs fictives de l’exemple dans les champs d’exemple de Meta. Catégorie proposée : **Utilitaire / Utility**. Aucun en-tête, bouton ou pied de page à ajouter.

Le backend WhatsApp est raccordé ; l’activation attend la configuration Meta et les tests de réception. Les mentions « À programmer » indiquent des événements futurs. Les SMS actuels continuent. Les messages de recouvrement restent en SMS ; Meta décide de l’admissibilité des autres modèles, notamment ceux liés au financement.

## 1. Paiement confirmé · direction

**Nom :** `gml_alerte_encaissement_direction_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Eric Ebabi

**Contenu :**

```text
GM Fleet — paiement confirmé.
Client : {{1}}.
Contrat : {{2}}.
Montant reçu : {{3}} {{4}}.
Part GML : {{5}} {{4}}. Part LOLC : {{6}} {{4}}.
Mode : {{7}}. Date : {{8}}.
Référence : {{9}}.
Cet avis correspond à un encaissement enregistré.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : GMF-CTR-2026-000099
- `{{3}}` : 177,00
- `{{4}}` : USD
- `{{5}}` : 15,00
- `{{6}}` : 162,00
- `{{7}}` : Espèces
- `{{8}}` : 08/11/2026
- `{{9}}` : CAISSE-20261108-EXEMPLE

**Exemple du message :**

GM Fleet — paiement confirmé.
Client : Jean Exemple.
Contrat : GMF-CTR-2026-000099.
Montant reçu : 177,00 USD.
Part GML : 15,00 USD. Part LOLC : 162,00 USD.
Mode : Espèces. Date : 08/11/2026.
Référence : CAISSE-20261108-EXEMPLE.
Cet avis correspond à un encaissement enregistré.

---

## 2. Équipements encaissés · direction

**Nom :** `gml_equipement_encaisse_direction_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Eric Ebabi

**Contenu :**

```text
GM Fleet — règlement équipements Car na ngai enregistré.
Client : {{1}}. Montant encaissé : {{2}} USD.
Forfait prévu : 240 USD, soit tracker 130 USD + installation 20 USD + service 7,50 USD par mois × 12 = 90 USD.
Date : {{3}}. Référence : {{4}}.
Le montant encaissé ci-dessus est le paiement réel, même en cas de règlement partiel.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : 240,00
- `{{3}}` : 04/11/2026
- `{{4}}` : EQUIPEMENT-EXEMPLE

**Exemple du message :**

GM Fleet — règlement équipements Car na ngai enregistré.
Client : Jean Exemple. Montant encaissé : 240,00 USD.
Forfait prévu : 240 USD, soit tracker 130 USD + installation 20 USD + service 7,50 USD par mois × 12 = 90 USD.
Date : 04/11/2026. Référence : EQUIPEMENT-EXEMPLE.
Le montant encaissé ci-dessus est le paiement réel, même en cas de règlement partiel.

---

## 3. Dépôt LOLC enregistré · direction

**Nom :** `gml_depot_lolc_direction_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Eric Ebabi

**Contenu :**

```text
GM Fleet — dépôt client LOLC enregistré.
Client : {{1}}. Dossier : {{2}}.
Montant du dépôt : {{3}} USD.
Date : {{4}}. Référence : {{5}}.
Part GML sur cette écriture : 0 USD. Les équipements GML sont suivis dans leur règlement séparé.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CNG-2026-000099
- `{{3}}` : 1400,00
- `{{4}}` : 04/11/2026
- `{{5}}` : DEPOT-EXEMPLE

**Exemple du message :**

GM Fleet — dépôt client LOLC enregistré.
Client : Jean Exemple. Dossier : CNG-2026-000099.
Montant du dépôt : 1400,00 USD.
Date : 04/11/2026. Référence : DEPOT-EXEMPLE.
Part GML sur cette écriture : 0 USD. Les équipements GML sont suivis dans leur règlement séparé.

---

## 4. Reçu de versement · client

**Nom :** `gml_versement_confirme_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur

**Contenu :**

```text
Bonjour {{1}}, votre versement GM Fleet de {{2}} {{3}} est confirmé.
Contrat : {{4}}. Date : {{5}}.
Mode : {{6}}. Référence du reçu : {{7}}.
Le paiement a été enregistré dans votre dossier.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : 177,00
- `{{3}}` : USD
- `{{4}}` : GMF-CTR-2026-000099
- `{{5}}` : 08/11/2026
- `{{6}}` : Mobile Money
- `{{7}}` : RECU-EXEMPLE

**Exemple du message :**

Bonjour Jean Exemple, votre versement GM Fleet de 177,00 USD est confirmé.
Contrat : GMF-CTR-2026-000099. Date : 08/11/2026.
Mode : Mobile Money. Référence du reçu : RECU-EXEMPLE.
Le paiement a été enregistré dans votre dossier.

---

## 5. Contre-écriture · client et direction

**Nom :** `gml_versement_annule_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur / Eric, avec envois distincts

**Contenu :**

```text
GM Fleet — annulation comptable de versement.
Client : {{1}}. Contrat : {{2}}.
Montant annulé : {{3}} {{4}}, dont GML {{5}} {{4}} et LOLC {{6}} {{4}}.
Référence initiale : {{7}}. Référence d’annulation : {{8}}.
Date : {{9}}. Contactez GM Fleet pour toute question sur cette correction.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : GMF-CTR-2026-000099
- `{{3}}` : 177,00
- `{{4}}` : USD
- `{{5}}` : 15,00
- `{{6}}` : 162,00
- `{{7}}` : RECU-EXEMPLE
- `{{8}}` : ANNULATION-EXEMPLE
- `{{9}}` : 09/11/2026

**Exemple du message :**

GM Fleet — annulation comptable de versement.
Client : Jean Exemple. Contrat : GMF-CTR-2026-000099.
Montant annulé : 177,00 USD, dont GML 15,00 USD et LOLC 162,00 USD.
Référence initiale : RECU-EXEMPLE. Référence d’annulation : ANNULATION-EXEMPLE.
Date : 09/11/2026. Contactez GM Fleet pour toute question sur cette correction.

---

## 6. Reçu de dépôt LOLC · client

**Nom :** `gml_depot_lolc_confirme_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client Car na ngai

**Contenu :**

```text
Bonjour {{1}}, votre dépôt client LOLC de {{2}} USD a été enregistré le {{3}}.
Dossier : {{4}}. Référence : {{5}}.
Cet avis confirme l’enregistrement du dépôt ; la suite du financement dépend de la décision LOLC.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : 1400,00
- `{{3}}` : 04/11/2026
- `{{4}}` : CNG-2026-000099
- `{{5}}` : DEPOT-EXEMPLE

**Exemple du message :**

Bonjour Jean Exemple, votre dépôt client LOLC de 1400,00 USD a été enregistré le 04/11/2026.
Dossier : CNG-2026-000099. Référence : DEPOT-EXEMPLE.
Cet avis confirme l’enregistrement du dépôt ; la suite du financement dépend de la décision LOLC.

---

## 7. Démarrage du véhicule et prochaine retenue

**Nom :** `gml_proprietaire_mise_exploitation_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire externe

Admissibilité à vérifier auprès de Meta.

**Contenu :**

```text
Bonjour {{1}}, votre véhicule {{2}}, plaque {{3}}, est confié au chauffeur {{11}} à partir du {{4}}.
Mandat : {{5}}.
Dette restante : {{6}} USD. Prochaine retenue prévue : {{7}} USD pour la période {{8}}.
Montant propriétaire cible : {{9}} USD. Net prévisionnel : {{10}} USD.
Cette prévision dépend des encaissements et des ajustements convenus. Le paiement mensuel sera confirmé séparément.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 04/11/2026
- `{{5}}` : GMF-MAN-2026-000099
- `{{6}}` : 280,50
- `{{7}}` : 165,50
- `{{8}}` : novembre 2026
- `{{9}}` : 500,00
- `{{10}}` : 334,50
- `{{11}}` : Daniel Exemple

**Exemple du message :**

Bonjour Marie Exemple, votre véhicule Toyota Vitz, plaque TEST-099, est confié au chauffeur Daniel Exemple à partir du 04/11/2026.
Mandat : GMF-MAN-2026-000099.
Dette restante : 280,50 USD. Prochaine retenue prévue : 165,50 USD pour la période novembre 2026.
Montant propriétaire cible : 500,00 USD. Net prévisionnel : 334,50 USD.
Cette prévision dépend des encaissements et des ajustements convenus. Le paiement mensuel sera confirmé séparément.

---

## 8. Détail d’une avance approuvée

**Nom :** `gml_proprietaire_recap_avance_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire externe

Admissibilité à vérifier auprès de Meta.

**Contenu :**

```text
GM Fleet — récapitulatif de votre avance approuvée.
Prestation : {{1}}.
Coût initial : {{2}} USD. Frais uniques de 15 % : {{3}} USD. Total : {{4}} USD.
Solde restant : {{5}} USD. Durée convenue : {{6}} mois.
Fin du remboursement : {{7}}. Accord : {{8}}.
Les retenues suivent l’échéancier enregistré avec votre accord.
```

**Exemples des variables :**

- `{{1}}` : Réparation moteur
- `{{2}}` : 200,00
- `{{3}}` : 30,00
- `{{4}}` : 230,00
- `{{5}}` : 230,00
- `{{6}}` : 2
- `{{7}}` : 31/12/2026
- `{{8}}` : ACCORD-REPARATION-EXEMPLE

**Exemple du message :**

GM Fleet — récapitulatif de votre avance approuvée.
Prestation : Réparation moteur.
Coût initial : 200,00 USD. Frais uniques de 15 % : 30,00 USD. Total : 230,00 USD.
Solde restant : 230,00 USD. Durée convenue : 2 mois.
Fin du remboursement : 31/12/2026. Accord : ACCORD-REPARATION-EXEMPLE.
Les retenues suivent l’échéancier enregistré avec votre accord.

---

## 9. Payout effectivement payé · propriétaire

**Nom :** `gml_proprietaire_paiement_mensuel_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire externe

**Contenu :**

```text
Bonjour {{1}}, votre règlement propriétaire GM Fleet a été enregistré comme payé.
Véhicule : {{2}}, plaque {{3}}. Période : {{4}}.
Montant propriétaire avant retenues : {{5}} USD. Remboursement des avances : {{6}} USD.
Net payé : {{7}} USD le {{8}}.
Référence : {{9}}. Cet avis correspond au paiement confirmé par notre caisse.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 01/11/2026 au 30/11/2026
- `{{5}}` : 500,00
- `{{6}}` : 165,50
- `{{7}}` : 334,50
- `{{8}}` : 30/11/2026
- `{{9}}` : PROPRIETAIRE-EXEMPLE

**Exemple du message :**

Bonjour Marie Exemple, votre règlement propriétaire GM Fleet a été enregistré comme payé.
Véhicule : Toyota Vitz, plaque TEST-099. Période : 01/11/2026 au 30/11/2026.
Montant propriétaire avant retenues : 500,00 USD. Remboursement des avances : 165,50 USD.
Net payé : 334,50 USD le 30/11/2026.
Référence : PROPRIETAIRE-EXEMPLE. Cet avis correspond au paiement confirmé par notre caisse.

---

## 10. Copie de contrat à signer

**Nom :** `gml_copie_contrat_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / chauffeur partenaire

**Contenu :**

```text
Bonjour {{1}}, votre copie du contrat GM Fleet {{2}} est disponible.
Téléchargement privé : {{3}}
Le lien est valable 7 jours. Vérifiez vos informations, signez le document puis remettez la copie signée à votre agent GM Fleet. Le téléchargement ne constitue pas une signature.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : GMF-MAN-2026-000099
- `{{3}}` : https://gmfleet.georgemichaellogistics.cd/contrat.html#token=EXEMPLE_FICTIF

**Exemple du message :**

Bonjour Marie Exemple, votre copie du contrat GM Fleet GMF-MAN-2026-000099 est disponible.
Téléchargement privé : https://gmfleet.georgemichaellogistics.cd/contrat.html#token=EXEMPLE_FICTIF
Le lien est valable 7 jours. Vérifiez vos informations, signez le document puis remettez la copie signée à votre agent GM Fleet. Le téléchargement ne constitue pas une signature.

---

## 11. Contrat chauffeur activé

**Nom :** `gml_contrat_active_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur

**Contenu :**

```text
Bonjour {{1}}, votre contrat GM Fleet {{2}} est activé.
Véhicule : {{3}}, plaque {{4}}. Début : {{5}}.
Premier règlement : {{6}}. Rythme convenu : {{7}}. Montant habituel par règlement : {{8}} {{9}}.
Les dates et montants enregistrés au contrat font référence.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : GMF-CTR-2026-000099
- `{{3}}` : Toyota Vitz
- `{{4}}` : TEST-099
- `{{5}}` : 04/11/2026
- `{{6}}` : 05/11/2026
- `{{7}}` : lundi à vendredi
- `{{8}}` : 31,00
- `{{9}}` : USD

**Exemple du message :**

Bonjour Jean Exemple, votre contrat GM Fleet GMF-CTR-2026-000099 est activé.
Véhicule : Toyota Vitz, plaque TEST-099. Début : 04/11/2026.
Premier règlement : 05/11/2026. Rythme convenu : lundi à vendredi. Montant habituel par règlement : 31,00 USD.
Les dates et montants enregistrés au contrat font référence.

---

## 12. Rendez-vous confirmé ou reprogrammé

**Nom :** `gml_rendez_vous_confirmation_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client / chauffeur / propriétaire

**Contenu :**

```text
Bonjour {{1}}, votre rendez-vous GM Fleet est confirmé.
Objet : {{2}}.
Date : {{3}} à {{4}}, heure de Kinshasa.
Lieu : {{5}}. Dossier : {{6}}.
Pour une modification, contactez votre agent GM Fleet.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : Entretien et test de conduite
- `{{3}}` : 09/11/2026
- `{{4}}` : 10:30
- `{{5}}` : Bureau GM Fleet, Gombe
- `{{6}}` : CHP-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, votre rendez-vous GM Fleet est confirmé.
Objet : Entretien et test de conduite.
Date : 09/11/2026 à 10:30, heure de Kinshasa.
Lieu : Bureau GM Fleet, Gombe. Dossier : CHP-2026-000099.
Pour une modification, contactez votre agent GM Fleet.

---

## 13. Annulation du rendez-vous

**Nom :** `gml_rendez_vous_annule_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

**Contenu :**

```text
Bonjour {{1}}, votre rendez-vous GM Fleet pour {{2}}, prévu le {{3}} à {{4}} heure de Kinshasa, est annulé.
Dossier : {{5}}. Contactez votre agent pour convenir d’une nouvelle date.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : Entretien et test de conduite
- `{{3}}` : 09/11/2026
- `{{4}}` : 10:30
- `{{5}}` : CHP-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, votre rendez-vous GM Fleet pour Entretien et test de conduite, prévu le 09/11/2026 à 10:30 heure de Kinshasa, est annulé.
Dossier : CHP-2026-000099. Contactez votre agent pour convenir d’une nouvelle date.

---

## 14. Accusé de réception candidature

**Nom :** `gml_candidature_recue_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

**Contenu :**

```text
Bonjour {{1}}, GM Fleet a reçu votre candidature au programme {{2}}.
Référence du dossier : {{3}}.
Notre équipe examine les informations transmises et vous contactera pour la suite. Conservez cette référence.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : Car na ngai · LOLC
- `{{3}}` : CNG-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, GM Fleet a reçu votre candidature au programme Car na ngai · LOLC.
Référence du dossier : CNG-2026-000099.
Notre équipe examine les informations transmises et vous contactera pour la suite. Conservez cette référence.

---

## 15. Nouvelle candidature · équipe

**Nom :** `gml_candidature_admin_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Administrateurs déjà désignés pour les candidatures

**Contenu :**

```text
GM Fleet — nouvelle candidature reçue.
Dossier : {{1}}. Nom : {{2}}.
Programme : {{3}}. Véhicule ou besoin déclaré : {{4}}.
Ouvrez l’espace opérations pour examiner les informations et les documents.
```

**Exemples des variables :**

- `{{1}}` : CNG-2026-000099
- `{{2}}` : Jean Exemple
- `{{3}}` : Car na ngai · LOLC
- `{{4}}` : Suzuki Swift

**Exemple du message :**

GM Fleet — nouvelle candidature reçue.
Dossier : CNG-2026-000099. Nom : Jean Exemple.
Programme : Car na ngai · LOLC. Véhicule ou besoin déclaré : Suzuki Swift.
Ouvrez l’espace opérations pour examiner les informations et les documents.

---

## 16. Candidature retenue

**Nom :** `gml_dossier_retenu_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

**Contenu :**

```text
Bonjour {{1}}, votre candidature GM Fleet {{2}} au programme {{3}} a été retenue pour poursuivre les étapes de traitement.
Votre agent vous indiquera la prochaine étape. Cette décision ne crée pas encore de contrat actif.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CNG-2026-000099
- `{{3}}` : Car na ngai · LOLC

**Exemple du message :**

Bonjour Jean Exemple, votre candidature GM Fleet CNG-2026-000099 au programme Car na ngai · LOLC a été retenue pour poursuivre les étapes de traitement.
Votre agent vous indiquera la prochaine étape. Cette décision ne crée pas encore de contrat actif.

---

## 17. Candidature refusée

**Nom :** `gml_dossier_refuse_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

**Contenu :**

```text
Bonjour {{1}}, l’examen de votre candidature GM Fleet {{2}} est terminé. Le dossier n’a pas été retenu.
Observation communiquée : {{3}}.
Vous pouvez contacter votre agent pour obtenir des précisions.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CHP-2026-000099
- `{{3}}` : Pièces requises non fournies après relance

**Exemple du message :**

Bonjour Jean Exemple, l’examen de votre candidature GM Fleet CHP-2026-000099 est terminé. Le dossier n’a pas été retenu.
Observation communiquée : Pièces requises non fournies après relance.
Vous pouvez contacter votre agent pour obtenir des précisions.

---

## 18. Accord LOLC confirmé

**Nom :** `gml_lolc_accord_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client Car na ngai

**Contenu :**

```text
Bonjour {{1}}, l’accord LOLC a été enregistré pour votre dossier GM Fleet {{2}}.
GML poursuit la sélection et les contrôles du véhicule. Votre agent vous informera des prochaines étapes de votre financement.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CNG-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, l’accord LOLC a été enregistré pour votre dossier GM Fleet CNG-2026-000099.
GML poursuit la sélection et les contrôles du véhicule. Votre agent vous informera des prochaines étapes de votre financement.

---

## 19. Complément demandé par LOLC

**Nom :** `gml_lolc_complement_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client Car na ngai

**Contenu :**

```text
Bonjour {{1}}, LOLC demande un complément pour votre dossier GM Fleet {{2}}.
Éléments demandés : {{3}}.
Contactez votre agent pour transmettre ces éléments et poursuivre le traitement.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CNG-2026-000099
- `{{3}}` : Justificatif de domicile actualisé

**Exemple du message :**

Bonjour Jean Exemple, LOLC demande un complément pour votre dossier GM Fleet CNG-2026-000099.
Éléments demandés : Justificatif de domicile actualisé.
Contactez votre agent pour transmettre ces éléments et poursuivre le traitement.

---

## 20. Refus LOLC

**Nom :** `gml_lolc_refus_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client Car na ngai

**Contenu :**

```text
Bonjour {{1}}, LOLC n’a pas approuvé le financement de votre dossier GM Fleet {{2}}.
Contactez votre agent GM Fleet pour les explications et les suites possibles concernant votre dossier.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CNG-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, LOLC n’a pas approuvé le financement de votre dossier GM Fleet CNG-2026-000099.
Contactez votre agent GM Fleet pour les explications et les suites possibles concernant votre dossier.

---

## 21. Installation terminée

**Nom :** `gml_equipements_installes_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client Car na ngai

**Contenu :**

```text
Bonjour {{1}}, l’installation des équipements {{2}} est terminée pour le véhicule de votre dossier GM Fleet {{3}}.
Notre équipe prépare les documents et la remise du véhicule. Votre agent vous communiquera les modalités.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : tracker et caméra
- `{{3}}` : CNG-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, l’installation des équipements tracker et caméra est terminée pour le véhicule de votre dossier GM Fleet CNG-2026-000099.
Notre équipe prépare les documents et la remise du véhicule. Votre agent vous communiquera les modalités.

---

## 22. Remise du véhicule enregistrée

**Nom :** `gml_vehicule_remis_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client Car na ngai

**Contenu :**

```text
Bonjour {{1}}, la remise de votre véhicule {{2}}, plaque {{3}}, a été enregistrée le {{4}} pour le dossier {{5}}.
Les photos de l’état initial et le kilométrage sont conservés dans votre dossier. Les versements suivent les dates de votre contrat activé.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : Suzuki Swift
- `{{3}}` : TEST-099
- `{{4}}` : 04/11/2026
- `{{5}}` : CNG-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, la remise de votre véhicule Suzuki Swift, plaque TEST-099, a été enregistrée le 04/11/2026 pour le dossier CNG-2026-000099.
Les photos de l’état initial et le kilométrage sont conservés dans votre dossier. Les versements suivent les dates de votre contrat activé.

---

## 23. Intégration chauffeur terminée

**Nom :** `gml_chauffeur_pret_affectation_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur partenaire

**Contenu :**

```text
Bonjour {{1}}, votre intégration chauffeur GM Fleet est terminée pour le dossier {{2}}.
Votre affectation sera confirmée selon les véhicules disponibles. Aucun versement ne commence avant l’activation de votre contrat et la date convenue.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CHP-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, votre intégration chauffeur GM Fleet est terminée pour le dossier CHP-2026-000099.
Votre affectation sera confirmée selon les véhicules disponibles. Aucun versement ne commence avant l’activation de votre contrat et la date convenue.

---

## 24. Rattachement Yango confirmé

**Nom :** `gml_yango_rattachement_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Partenaire Yango

**Contenu :**

```text
Bonjour {{1}}, votre rattachement à GM Fleet sur Yango a été confirmé pour le dossier {{2}}.
Votre agent reste votre contact pour le suivi de ce partenariat.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : YAN-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, votre rattachement à GM Fleet sur Yango a été confirmé pour le dossier YAN-2026-000099.
Votre agent reste votre contact pour le suivi de ce partenariat.

---

## 25. Demande de devis équipements reçue

**Nom :** `gml_devis_recu_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Demandeur équipements

**Contenu :**

```text
Bonjour {{1}}, GM Fleet a reçu votre demande de devis pour {{2}}.
Référence : {{3}}.
Notre équipe vous contactera pour confirmer le besoin, le prix et la planification de l’installation.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : tracker et caméra
- `{{3}}` : DEVIS-EXEMPLE

**Exemple du message :**

Bonjour Jean Exemple, GM Fleet a reçu votre demande de devis pour tracker et caméra.
Référence : DEVIS-EXEMPLE.
Notre équipe vous contactera pour confirmer le besoin, le prix et la planification de l’installation.

---

## 26. Nouvelle demande de devis · équipe

**Nom :** `gml_devis_admin_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Administrateurs candidatures

**Contenu :**

```text
GM Fleet — nouvelle demande de devis équipements.
Référence : {{1}}. Client : {{2}}.
Besoin : {{3}}.
Ouvrez l’espace opérations pour examiner la demande et préparer la réponse.
```

**Exemples des variables :**

- `{{1}}` : DEVIS-EXEMPLE
- `{{2}}` : Jean Exemple
- `{{3}}` : tracker et caméra

**Exemple du message :**

GM Fleet — nouvelle demande de devis équipements.
Référence : DEVIS-EXEMPLE. Client : Jean Exemple.
Besoin : tracker et caméra.
Ouvrez l’espace opérations pour examiner la demande et préparer la réponse.

---

## 27. Création du compte personnel

**Nom :** `gml_compte_equipe_invitation_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Membre de l’équipe invité

**Contenu :**

```text
Bonjour {{1}}, votre compte équipe GM Fleet a été créé avec le rôle {{2}}.
Pour terminer la configuration de votre accès, utilisez le lien personnel suivant : {{3}}
Ne partagez pas ce lien. Contactez votre administrateur s’il est expiré.
```

**Exemples des variables :**

- `{{1}}` : Agent Exemple
- `{{2}}` : Agent opérations
- `{{3}}` : https://gmfleet.georgemichaellogistics.cd/set-password.html#token_hash=EXEMPLE_FICTIF

**Exemple du message :**

Bonjour Agent Exemple, votre compte équipe GM Fleet a été créé avec le rôle Agent opérations.
Pour terminer la configuration de votre accès, utilisez le lien personnel suivant : https://gmfleet.georgemichaellogistics.cd/set-password.html#token_hash=EXEMPLE_FICTIF
Ne partagez pas ce lien. Contactez votre administrateur s’il est expiré.

---

## 28. Pièces à compléter

**Nom :** `gml_documents_a_completer_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

À programmer.

**Contenu :**

```text
Bonjour {{1}}, votre dossier GM Fleet {{2}} nécessite les pièces suivantes : {{3}}.
Merci de les transmettre à votre agent avant le {{4}} pour poursuivre le traitement.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : CNG-2026-000099
- `{{3}}` : Permis valide et justificatif de domicile
- `{{4}}` : 10/11/2026

**Exemple du message :**

Bonjour Jean Exemple, votre dossier GM Fleet CNG-2026-000099 nécessite les pièces suivantes : Permis valide et justificatif de domicile.
Merci de les transmettre à votre agent avant le 10/11/2026 pour poursuivre le traitement.

---

## 29. Rappel de rendez-vous

**Nom :** `gml_rappel_rendez_vous_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

À programmer.

**Contenu :**

```text
Bonjour {{1}}, rappel de votre rendez-vous GM Fleet : {{2}}, le {{3}} à {{4}}, heure de Kinshasa.
Lieu : {{5}}. Dossier : {{6}}.
Contactez votre agent si vous devez modifier ce rendez-vous.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : Entretien et conduite
- `{{3}}` : 09/11/2026
- `{{4}}` : 10:30
- `{{5}}` : Bureau GM Fleet, Gombe
- `{{6}}` : CHP-2026-000099

**Exemple du message :**

Bonjour Jean Exemple, rappel de votre rendez-vous GM Fleet : Entretien et conduite, le 09/11/2026 à 10:30, heure de Kinshasa.
Lieu : Bureau GM Fleet, Gombe. Dossier : CHP-2026-000099.
Contactez votre agent si vous devez modifier ce rendez-vous.

---

## 30. Échéance quotidienne ou hebdomadaire

**Nom :** `gml_rappel_versement_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur

À programmer. Admissibilité à vérifier auprès de Meta.

**Contenu :**

```text
Bonjour {{1}}, votre règlement GM Fleet du {{2}} arrive à échéance.
Contrat : {{3}}. Montant à régler : {{4}} {{5}}, dont échéances antérieures {{6}} {{5}}.
Cet avis suit votre calendrier contractuel. Si vous avez déjà payé, contactez la caisse avec votre reçu.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : 08/11/2026
- `{{3}}` : GMF-CTR-2026-000099
- `{{4}}` : 177,00
- `{{5}}` : USD
- `{{6}}` : 0,00

**Exemple du message :**

Bonjour Jean Exemple, votre règlement GM Fleet du 08/11/2026 arrive à échéance.
Contrat : GMF-CTR-2026-000099. Montant à régler : 177,00 USD, dont échéances antérieures 0,00 USD.
Cet avis suit votre calendrier contractuel. Si vous avez déjà payé, contactez la caisse avec votre reçu.

---

## 31. Retard selon le calendrier réel

**Nom :** `gml_retard_versement_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur

SMS uniquement — ne pas créer dans Meta.

**Contenu :**

```text
Bonjour {{1}}, au {{2}}, un solde de {{3}} {{4}} reste en retard sur votre contrat GM Fleet {{5}}.
Première échéance dépassée : {{6}}.
Merci de contacter la caisse pour vérifier la situation et convenir du règlement.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : 09/11/2026
- `{{3}}` : 177,00
- `{{4}}` : USD
- `{{5}}` : GMF-CTR-2026-000099
- `{{6}}` : 08/11/2026

**Exemple du message :**

Bonjour Jean Exemple, au 09/11/2026, un solde de 177,00 USD reste en retard sur votre contrat GM Fleet GMF-CTR-2026-000099.
Première échéance dépassée : 08/11/2026.
Merci de contacter la caisse pour vérifier la situation et convenir du règlement.

---

## 32. Contrôle du dimanche

**Nom :** `gml_controle_dimanche_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur affecté

À programmer.

**Contenu :**

```text
Bonjour {{1}}, le contrôle GM Fleet de votre véhicule {{2}}, plaque {{3}}, est prévu le dimanche {{4}} à {{5}}, heure de Kinshasa.
Lieu : {{6}}.
Présentez le véhicule pour les vérifications, les photos et le relevé du kilométrage.
```

**Exemples des variables :**

- `{{1}}` : Jean Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 08/11/2026
- `{{5}}` : 09:00
- `{{6}}` : Centre de contrôle GM Fleet

**Exemple du message :**

Bonjour Jean Exemple, le contrôle GM Fleet de votre véhicule Toyota Vitz, plaque TEST-099, est prévu le dimanche 08/11/2026 à 09:00, heure de Kinshasa.
Lieu : Centre de contrôle GM Fleet.
Présentez le véhicule pour les vérifications, les photos et le relevé du kilométrage.

---

## 33. Demande d’accord avant préfinancement

**Nom :** `gml_reparation_accord_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire externe

À programmer. Admissibilité à vérifier auprès de Meta.

**Contenu :**

```text
Bonjour {{1}}, pour votre véhicule {{2}}, plaque {{3}}, une réparation est proposée : {{4}}.
Coût : {{5}} USD. Si GML préfinance, frais uniques de 15 % : {{6}} USD, total {{7}} USD, sur {{8}} mois.
Aucune avance n’est confirmée par cet avis. Contactez votre agent pour valider ou refuser ces conditions.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : Remplacement de la pompe à eau
- `{{5}}` : 200,00
- `{{6}}` : 30,00
- `{{7}}` : 230,00
- `{{8}}` : 2

**Exemple du message :**

Bonjour Marie Exemple, pour votre véhicule Toyota Vitz, plaque TEST-099, une réparation est proposée : Remplacement de la pompe à eau.
Coût : 200,00 USD. Si GML préfinance, frais uniques de 15 % : 30,00 USD, total 230,00 USD, sur 2 mois.
Aucune avance n’est confirmée par cet avis. Contactez votre agent pour valider ou refuser ces conditions.

---

## 34. Copie signée vérifiée

**Nom :** `gml_signature_recue_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / chauffeur

À programmer.

**Contenu :**

```text
Bonjour {{1}}, GM Fleet a reçu et vérifié la copie signée de votre contrat {{2}} le {{3}}.
Le document est conservé dans votre dossier. Votre agent vous informera de toute prochaine étape nécessaire.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : GMF-MAN-2026-000099
- `{{3}}` : 05/11/2026

**Exemple du message :**

Bonjour Marie Exemple, GM Fleet a reçu et vérifié la copie signée de votre contrat GMF-MAN-2026-000099 le 05/11/2026.
Le document est conservé dans votre dossier. Votre agent vous informera de toute prochaine étape nécessaire.

---

## 35. Incident opérationnel à vérifier

**Nom :** `gml_service_indisponible_direction_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Direction

À programmer.

**Contenu :**

```text
GM Fleet — incident à vérifier.
Service concerné : {{1}}. Référence : {{2}}.
Constat : {{3}}. Date : {{4}}.
Ouvrez le journal des opérations avant de relancer une action susceptible de créer un doublon.
```

**Exemples des variables :**

- `{{1}}` : Paiement digital
- `{{2}}` : TRANSACTION-EXEMPLE
- `{{3}}` : Statut fournisseur non confirmé
- `{{4}}` : 04/11/2026 à 14:30, Kinshasa

**Exemple du message :**

GM Fleet — incident à vérifier.
Service concerné : Paiement digital. Référence : TRANSACTION-EXEMPLE.
Constat : Statut fournisseur non confirmé. Date : 04/11/2026 à 14:30, Kinshasa.
Ouvrez le journal des opérations avant de relancer une action susceptible de créer un doublon.

---

## 36. Affectation du chauffeur

**Nom :** `gml_affectation_chauffeur_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Chauffeur

**Contenu :**

```text
Bonjour {{1}}, vous êtes affecté au véhicule {{2}}, plaque {{3}}, du propriétaire {{4}}. Début du service : {{5}}. Premier versement : {{6}}. Montant habituel : {{7}} USD. Votre contrat GM Fleet fait référence.
```

**Exemples des variables :**

- `{{1}}` : Daniel Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : Marie Exemple
- `{{5}}` : 09/11/2026
- `{{6}}` : 10/11/2026
- `{{7}}` : 31,00

**Exemple du message :**

Bonjour Daniel Exemple, vous êtes affecté au véhicule Toyota Vitz, plaque TEST-099, du propriétaire Marie Exemple. Début du service : 09/11/2026. Premier versement : 10/11/2026. Montant habituel : 31,00 USD. Votre contrat GM Fleet fait référence.

---

## 37. Invitation GML Mobile

**Nom :** `gml_mobile_invitation_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire

À programmer.

**Contenu :**

```text
Bonjour {{1}}, votre accès GML Mobile est prêt pour votre véhicule {{2}}, plaque {{3}}. Téléchargez l’application ici : {{4}}. Activez votre compte avec ce lien personnel : {{5}}. Ne partagez pas ce lien.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : https://example.com/gml-mobile
- `{{5}}` : https://example.com/activation/EXEMPLE

**Exemple du message :**

Bonjour Marie Exemple, votre accès GML Mobile est prêt pour votre véhicule Toyota Vitz, plaque TEST-099. Téléchargez l’application ici : https://example.com/gml-mobile. Activez votre compte avec ce lien personnel : https://example.com/activation/EXEMPLE. Ne partagez pas ce lien.

---

## 38. Service suspendu

**Nom :** `gml_service_suspendu_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / chauffeur, envois distincts

À programmer.

**Contenu :**

```text
Bonjour {{1}}, le service du véhicule {{2}}, plaque {{3}}, est suspendu à partir du {{4}}. Motif : {{5}}. Votre agent GM Fleet vous informera de la reprise.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 12/11/2026
- `{{5}}` : Réparation en atelier

**Exemple du message :**

Bonjour Marie Exemple, le service du véhicule Toyota Vitz, plaque TEST-099, est suspendu à partir du 12/11/2026. Motif : Réparation en atelier. Votre agent GM Fleet vous informera de la reprise.

---

## 39. Reprise du service

**Nom :** `gml_service_repris_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / chauffeur, envois distincts

À programmer.

**Contenu :**

```text
Bonjour {{1}}, le service du véhicule {{2}}, plaque {{3}}, reprend le {{4}} avec le chauffeur {{5}}. Les dates de versement suivent le calendrier enregistré par GM Fleet.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 16/11/2026
- `{{5}}` : Daniel Exemple

**Exemple du message :**

Bonjour Marie Exemple, le service du véhicule Toyota Vitz, plaque TEST-099, reprend le 16/11/2026 avec le chauffeur Daniel Exemple. Les dates de versement suivent le calendrier enregistré par GM Fleet.

---

## 40. Fin du service ou de l’affectation

**Nom :** `gml_fin_service_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / chauffeur, envois distincts

À programmer.

**Contenu :**

```text
Bonjour {{1}}, la fin du service ou de l’affectation du véhicule {{2}}, plaque {{3}}, est enregistrée au {{4}}. Référence : {{5}}. Contactez votre agent GM Fleet pour les modalités de restitution et le bilan final.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 30/11/2026
- `{{5}}` : FIN-EXEMPLE

**Exemple du message :**

Bonjour Marie Exemple, la fin du service ou de l’affectation du véhicule Toyota Vitz, plaque TEST-099, est enregistrée au 30/11/2026. Référence : FIN-EXEMPLE. Contactez votre agent GM Fleet pour les modalités de restitution et le bilan final.

---

## 41. Résultat de l’inspection

**Nom :** `gml_inspection_resultat_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / chauffeur, selon le dossier

À programmer.

**Contenu :**

```text
Bonjour {{1}}, le contrôle du véhicule {{2}}, plaque {{3}}, a été effectué le {{4}}. Résultat : {{5}}. Prochaine action : {{6}}. Les photos et le kilométrage sont conservés par GM Fleet.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 08/11/2026
- `{{5}}` : Contrôle conforme
- `{{6}}` : Prochain contrôle dimanche

**Exemple du message :**

Bonjour Marie Exemple, le contrôle du véhicule Toyota Vitz, plaque TEST-099, a été effectué le 08/11/2026. Résultat : Contrôle conforme. Prochaine action : Prochain contrôle dimanche. Les photos et le kilométrage sont conservés par GM Fleet.

---

## 42. Incident signalé sur le véhicule

**Nom :** `gml_incident_vehicule_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / direction, selon le dossier

À programmer.

**Contenu :**

```text
Bonjour {{1}}, un incident a été signalé pour le véhicule {{2}}, plaque {{3}}, le {{4}}. Constat : {{5}}. Référence : {{6}}. GM Fleet vous contactera pour la suite. Aucun coût n’est approuvé par ce message.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Toyota Vitz
- `{{3}}` : TEST-099
- `{{4}}` : 12/11/2026
- `{{5}}` : Bruit moteur à vérifier
- `{{6}}` : INCIDENT-EXEMPLE

**Exemple du message :**

Bonjour Marie Exemple, un incident a été signalé pour le véhicule Toyota Vitz, plaque TEST-099, le 12/11/2026. Constat : Bruit moteur à vérifier. Référence : INCIDENT-EXEMPLE. GM Fleet vous contactera pour la suite. Aucun coût n’est approuvé par ce message.

---

## 43. GPS ou caméra indisponible

**Nom :** `gml_suivi_indisponible_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / équipe technique

À programmer.

**Contenu :**

```text
Bonjour {{1}}, les données {{2}} du véhicule {{3}}, plaque {{4}}, ne sont plus actualisées depuis le {{5}}. La dernière position connue ne confirme pas sa position actuelle. GM Fleet vérifie la connexion.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : GPS
- `{{3}}` : Toyota Vitz
- `{{4}}` : TEST-099
- `{{5}}` : 12/11/2026 à 10:30, Kinshasa

**Exemple du message :**

Bonjour Marie Exemple, les données GPS du véhicule Toyota Vitz, plaque TEST-099, ne sont plus actualisées depuis le 12/11/2026 à 10:30, Kinshasa. La dernière position connue ne confirme pas sa position actuelle. GM Fleet vérifie la connexion.

---

## 44. Alerte de surveillance configurée

**Nom :** `gml_alerte_vehicule_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Propriétaire / équipe autorisée

À programmer.

**Contenu :**

```text
Bonjour {{1}}, une alerte {{2}} a été détectée pour le véhicule {{3}}, plaque {{4}}, le {{5}}. Consultez GML Mobile pour vérifier les informations et contactez GM Fleet si nécessaire.
```

**Exemples des variables :**

- `{{1}}` : Marie Exemple
- `{{2}}` : Sortie de la zone autorisée
- `{{3}}` : Toyota Vitz
- `{{4}}` : TEST-099
- `{{5}}` : 12/11/2026 à 10:40, Kinshasa

**Exemple du message :**

Bonjour Marie Exemple, une alerte Sortie de la zone autorisée a été détectée pour le véhicule Toyota Vitz, plaque TEST-099, le 12/11/2026 à 10:40, Kinshasa. Consultez GML Mobile pour vérifier les informations et contactez GM Fleet si nécessaire.

---

## 45. Paiement digital non confirmé

**Nom :** `gml_paiement_digital_statut_fr`  
**Langue :** Français (`fr`)  
**Destinataire :** Client

À programmer.

**Contenu :**

```text
Bonjour {{1}}, votre tentative de paiement GM Fleet de {{2}} USD, référence {{3}}, a le statut suivant : {{4}}. Ce message ne confirme aucun encaissement. Si votre compte a été débité, contactez la caisse avec cette référence avant une nouvelle tentative.
```

**Exemples des variables :**

- `{{1}}` : Daniel Exemple
- `{{2}}` : 31,00
- `{{3}}` : PAIEMENT-EXEMPLE
- `{{4}}` : En attente de confirmation du fournisseur

**Exemple du message :**

Bonjour Daniel Exemple, votre tentative de paiement GM Fleet de 31,00 USD, référence PAIEMENT-EXEMPLE, a le statut suivant : En attente de confirmation du fournisseur. Ce message ne confirme aucun encaissement. Si votre compte a été débité, contactez la caisse avec cette référence avant une nouvelle tentative.

---

## Code de connexion — à créer séparément

**Nom :** `gml_code_acces_fr`  
**Langue :** Français (`fr`)  
**Catégorie :** Authentification / Authentication  
**Contenu :** utiliser le texte et le bouton de code fournis par Meta dans son formulaire Authentication.  
**Exemple du code :** `123456`.

À programmer : le backend doit générer, vérifier et faire expirer le code. Ne pas créer un modèle Utility pour un code de sécurité.
