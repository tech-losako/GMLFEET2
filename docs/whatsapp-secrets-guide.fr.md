# WhatsApp — noms et valeurs à saisir dans Supabase

Ouvrir **GMLFEET2 → Edge Functions → Secrets**. Ajouter les entrées une par une.

Dans **Name / Nom**, copier seulement le nom ci-dessous. Dans **Value / Valeur**, mettre la valeur correspondante. **Ne pas ajouter de signe `=`, de guillemets, d’espaces autour du nom, ni le texte `REPLACE_WITH…`.** Le signe `=` est uniquement utilisé pour l’import d’un fichier `.env` ; il n’est pas nécessaire dans le formulaire à deux champs.

Exemple :

- **Name :** `WHATSAPP_TEMPLATE_LANGUAGE`
- **Value :** `fr`

| Name / Nom exact | Value / Valeur à mettre | Où la trouver |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Le véritable jeton d’accès Meta de production | Configuration API WhatsApp / compte système Meta autorisé à envoyer les messages. |
| `WHATSAPP_PHONE_NUMBER_ID` | Le Phone Number ID | Meta → configuration API WhatsApp. C’est un identifiant numérique, pas le numéro de téléphone `+243…`. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Le WhatsApp Business Account ID, appelé WABA ID | Configuration du compte WhatsApp Business. Ce n’est pas le Business Portfolio ID. |
| `WHATSAPP_GRAPH_VERSION` | La version de l’API Graph utilisée dans la configuration Meta, au format `vXX.X` | Copier la version effectivement sélectionnée dans Meta, pas le texte `vXX.X`. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `fr` | Saisir simplement `fr` ; choisir Français pour les modèles. |
| `WHATSAPP_ENABLED` | `false` | Saisir simplement `false` pour préparer. L’activation à `true` se fera après raccordement et test. |

Le jeton, le Phone Number ID et le WABA ID viennent de Meta et concernent le même numéro que GML. Aucun Verify Token ni App Secret supplémentaire n’est nécessaire : le webhook appartient à GML. La version, la langue et le bouton d’activation sont des paramètres de configuration, même si Supabase les conserve dans Secrets.

Ces variables sont lues par le backend. **Conserver `WHATSAPP_ENABLED=false` jusqu’au test livré et au test de repli SMS.** Aucun secret réel n’est présent dans ces documents. Ne pas coller les clés dans le chat ou dans Git.

Pour créer les modèles : ouvrir [le catalogue simple](whatsapp-template-pack.fr.html).

Références : [configuration Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), [modèles Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview).
