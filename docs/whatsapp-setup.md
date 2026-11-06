# GM Fleet — préparation de WhatsApp

**Guide simple à utiliser : [noms et valeurs des secrets](whatsapp-secrets-guide.fr.md). Dans le formulaire Supabase, ne pas saisir de signe `=`.**

**Modèles : [catalogue simple](whatsapp-template-pack.fr.html)** — nom, langue, contenu, exemples, puis modèle suivant. [Liste de couverture](whatsapp-notification-coverage.fr.md).

Mise à jour : 6 novembre 2026. Le transport utilise le numéro WhatsApp partagé de GML. Les SMS restent actifs pendant la vérification des clés, des modèles et du test de réception. Voir `whatsapp-sending.md`.

## 1. Modèles

Ouvrir `whatsapp-template-pack.fr.html` pour copier les messages, ou utiliser `whatsapp-template-pack.fr.md`. Le JSON `whatsapp-templates.fr.json` contient les noms exacts, les paramètres et la correspondance des événements pour le futur backend.

Dans WhatsApp Manager : créer les modèles en **French / Français**, code **`fr`**, avec variables numérotées. La catégorie Utility est proposée pour les messages de suivi. Meta confirme la catégorie et l’approbation. Ne pas transformer une variable en message libre complet : chaque paramètre doit garder le sens indiqué dans le pack.

La [politique officielle, section 4](https://whatsappbusiness.com/policy/) interdit le recouvrement de dettes. Le brouillon `gml_retard_versement_fr` est donc réservé au SMS ; il ne doit pas être soumis comme Utility. Les messages liés aux avances ou au financement portent une note de vérification auprès de Meta. Un modèle approuvé ne dispense pas de respecter cette restriction.

Commencer par la priorité 1. La priorité 3 n’est pas automatisée dans l’application. La réinitialisation par lien personnel reste en SMS ; un éventuel modèle Authentication avec OTP nécessite un vrai backend de codes temporaires.

## 2. Secrets à ajouter dans Supabase

Projet **GMLFEET2** → **Edge Functions → Secrets**. Utiliser exactement ces noms. Le fichier `whatsapp-secrets.env.example` est un gabarit à compléter ; il ne contient aucune vraie clé. Ne pas importer les mots `REPLACE_WITH_…` comme de vraies informations d’accès.

| Nom | Valeur à renseigner | Origine / rôle |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Jeton Meta de production | Compte système autorisé pour le WABA et l’envoi des messages ; conserver ce jeton côté serveur. |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant du numéro WhatsApp Business | Ce n’est pas le numéro `+243…` ; copier le Phone Number ID dans Meta. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Identifiant du compte WhatsApp Business | WABA ID ; distinct du Business Portfolio ID et du numéro de téléphone. |
| `WHATSAPP_GRAPH_VERSION` | Version Graph API prise en charge dans votre configuration Meta, au format `vXX.X` | Paramètre serveur ; aucune version obsolète n’est imposée dans le gabarit. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `fr` | Doit correspondre exactement à la langue des modèles approuvés. |
| `WHATSAPP_ENABLED` | `false` pendant la préparation | Ne passer à `true` qu’après raccordement du backend, vérification du webhook et test autorisé. Ce drapeau est lu par le dispatcher. |

Le connecteur Supabase disponible dans cette session n’expose pas de commande pour créer ou modifier les secrets Edge Functions. Aucun secret live n’a donc été créé par ces fichiers. Les emplacements sont définis et prêts à être renseignés dans Supabase ; ne pas poster les valeurs dans le chat. Aucun changement n’a été fait aux secrets SMS.

## 3. Règles du backend

- Adapter chaque événement vers un modèle approuvé et ses paramètres depuis les données enregistrées. `case_milestone` doit être distingué par étape ; `boss_payment` par type d’écriture. Le nom générique de l’événement ne suffit pas pour choisir le texte.
- Conserver la destination actuelle : Eric pour les alertes de caisse ; client pour ses confirmations ; propriétaire pour démarrage, dette et paiement mensuel réel. Aucun avis à chaque versement chauffeur pour le propriétaire.
- Pour les rendez-vous, respecter l’option de notification choisie par l’agent. Ne pas contacter une personne qui a refusé WhatsApp ; conserver le SMS selon les préférences et autorisations applicables.
- Transmettre les paramètres financiers depuis les écritures effectives, jamais depuis les exemples. Paiement chauffeur : GML/LOLC selon la ventilation réelle. Équipement : montant reçu et forfait prévu 130 + 20 + 7,50 × 12 = 240 USD. Dépôt LOLC : ne pas y réinclure le règlement GML.
- Ne pas modifier la date de signature ou marquer un contrat signé au téléchargement. Le lien contrat existant expire après sept jours ; conserver le fragment complet `#token=…`, sans le journaliser.
- Ne pas créer de webhook Meta pour GM Fleet. GML relaie les reçus inconnus via `gml-mobile-bridge`, action signée `whatsapp_status` ; le secret de pont existant reste côté serveur.
- Enregistrer les identifiants de messages et les états livré/échec. Prévenir les doublons ; ne pas envoyer SMS et WhatsApp en double par défaut. Un état inconnu ne justifie pas une relance aveugle.
- Tester seulement sur un numéro autorisé, puis activer après vérification. Aucun test WhatsApp ni aucune soumission Meta ne sont effectués par le pack.

## Références officielles

- [Gestion des modèles WhatsApp](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/)
- [Documentation Meta des modèles](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [Politique WhatsApp Business](https://business.whatsapp.com/policy)
