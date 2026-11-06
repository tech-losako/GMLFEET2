# Nouveaux modèles WhatsApp — rappels de versement

Préparés le 6 novembre 2026. Deux propositions à ajouter au catalogue existant.
Les anciens modèles de reçus, contrats, affectations et rendez-vous restent utiles.
Ces propositions remplacent, pour les nouveaux rappels, le modèle général n° 30
`gml_rappel_versement_fr`, dont le texte comportait des échéances antérieures.
Si ce modèle est déjà créé dans Meta, ne le supprimez pas : conservez-le sans
le raccorder aux nouveaux rappels jusqu’à vérification de son contenu.

## 1. Rappel du versement du jour

**Nom du modèle :** `gml_rappel_versement_journalier_fr`

**Langue :** Français — `fr`

**Catégorie proposée :** Utilitaire — `UTILITY`, sous réserve de validation par Meta.

**Contenu à copier :**

```text
Bonjour {{1}}, votre versement GM Fleet du {{2}} est prévu aujourd’hui avant 21h00, heure de Kinshasa.
Montant de cette échéance : {{3}} {{4}}.
Votre lien personnel de paiement : {{5}}
Si ce versement est déjà enregistré, aucune action n’est nécessaire. Contactez votre agent pour toute question.
```

**Exemple :**

```text
Bonjour François Exemple, votre versement GM Fleet du 06/11/2026 est prévu aujourd’hui avant 21h00, heure de Kinshasa.
Montant de cette échéance : 31,00 USD.
Votre lien personnel de paiement : https://gmfleet.georgemichaellogistics.cd/p#token=0000000000000000000000000000000000000000000000000000000000000000
Si ce versement est déjà enregistré, aucune action n’est nécessaire. Contactez votre agent pour toute question.
```

Le lien ci-dessus est fictif et ne donne aucun accès. Dans les exemples Meta,
utilisez un lien de démonstration ; ne collez pas le lien privé d’un vrai chauffeur.

| Variable | À renseigner | Exemple |
|---|---|---|
| `{{1}}` | Prénom du chauffeur | François Exemple |
| `{{2}}` | Date de l’échéance | 06/11/2026 |
| `{{3}}` | Solde réel de cette échéance uniquement | 31,00 |
| `{{4}}` | Devise du contrat | USD |
| `{{5}}` | Lien personnel généré, valable 48 heures | Lien fictif ci-dessus |

**Déclenchement prévu :** véhicule géré, du lundi au vendredi à 18h00 Kinshasa,
avant l’échéance de 21h00. Aucun rappel si payé, date exclue, contrat/chauffeur
inactif, pause ou désinscription. Une réparation déjà intégrée à l’échéance
peut modifier le montant ; ne pas écrire systématiquement 31 USD dans le backend.

## 2. Rappel du versement hebdomadaire de demain

**Nom du modèle :** `gml_rappel_versement_hebdomadaire_fr`

**Langue :** Français — `fr`

**Catégorie proposée :** Utilitaire — `UTILITY`, sous réserve de validation par Meta
de ce cas d’usage lié au programme Car na ngai / financement LOLC.

**Contenu à copier :**

```text
Bonjour {{1}}, votre versement hebdomadaire GM Fleet est prévu demain, le {{2}}, selon votre calendrier contractuel.
Montant de cette échéance : {{3}} {{4}}.
Votre lien personnel de paiement : {{5}}
Si ce versement est déjà enregistré, aucune action n’est nécessaire. Contactez votre agent pour toute question.
```

**Exemple :**

```text
Bonjour Jean Exemple, votre versement hebdomadaire GM Fleet est prévu demain, le 08/11/2026, selon votre calendrier contractuel.
Montant de cette échéance : 177,00 USD.
Votre lien personnel de paiement : https://gmfleet.georgemichaellogistics.cd/p#token=0000000000000000000000000000000000000000000000000000000000000000
Si ce versement est déjà enregistré, aucune action n’est nécessaire. Contactez votre agent pour toute question.
```

Le lien est fictif. Les cinq variables ont la même signification que pour le
modèle quotidien ; `{{3}}` correspond uniquement à l’échéance hebdomadaire à venir,
sans additionner les échéances antérieures.

**Déclenchement prévu :** 18h00 Kinshasa la veille de la véritable collecte
hebdomadaire. Le montant dépend du contrat et des versements déjà enregistrés :
177 USD est un exemple. Aucun changement automatique des contrats à cadence quotidienne.

## Ce qui reste en SMS

- Le rattrapage du samedi, qui concerne des versements déjà manqués ou incomplets.
- Les demandes de règlement d’arriérés et autres messages de recouvrement.
- Les rappels pour lesquels aucun modèle approuvé, consentement WhatsApp ou
  raccordement valide n’est disponible.

Meta interdit le recouvrement de dettes dans sa politique. Pour ce projet, le
routage proposé est donc conservateur : WhatsApp uniquement avant l’échéance,
avec **aucun arriéré**, et après validation du cas d’usage par Meta. Si un arriéré
est présent, conserver le SMS actuel ; ne pas masquer cet arriéré dans un modèle
WhatsApp tout en conservant un lien prérempli pour le recouvrer.

Source vérifiée le 6 novembre 2026 :
[Politique WhatsApp Business, sections 1, 2 et 4](https://whatsappbusiness.com/policy/).
Un consentement WhatsApp est requis ; un numéro de téléphone ou une case SMS ne
constitue pas ce consentement. Un modèle approuvé ne lève pas les restrictions
d’activité de la plateforme.

## État du raccordement

Les nouveaux rappels sont déployés **en SMS uniquement**. Ces modèles sont des
brouillons à soumettre : ils ne sont ni soumis ni approuvés par ce document, et
aucun envoi WhatsApp n’est activé.

Après validation et configuration Meta, le raccordement devra utiliser les noms
exacts ci-dessus, le consentement WhatsApp enregistré, la revérification du solde,
les pauses/désinscriptions, les liens de 48 heures et la déduplication existants.
Il faudra définir un envoi WhatsApp prioritaire avec repli SMS, afin de ne pas
envoyer le même rappel deux fois sans choix explicite. Aucun identifiant ni secret
supplémentaire n’est ajouté par ces deux noms de modèles.
