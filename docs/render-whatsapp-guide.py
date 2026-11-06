"""Render the notification catalogue as a simple copy-and-paste guide."""
import json, html
from pathlib import Path

root = Path(__file__).resolve().parent
catalog = json.loads((root/'whatsapp-templates.fr.json').read_text(encoding='utf-8'))
templates = catalog['templates']
intro = '''# GM Fleet — modèles de notification

Pour chaque modèle : copier le **nom**, choisir **Français (`fr`)**, puis copier le **contenu**. Les valeurs entre `{{1}}` et `{{2}}` sont des variables ; utiliser les valeurs fictives de l’exemple dans les champs d’exemple de Meta. Catégorie proposée : **Utilitaire / Utility**. Aucun en-tête, bouton ou pied de page à ajouter.

Le backend WhatsApp est raccordé ; l’activation attend la configuration Meta et les tests de réception. Les mentions « À programmer » indiquent des événements futurs. Les SMS actuels continuent. Les messages de recouvrement restent en SMS ; Meta décide de l’admissibilité des autres modèles, notamment ceux liés au financement.

'''
lines = [intro]
cards = []
for i, t in enumerate(templates, 1):
    note = 'SMS uniquement — ne pas créer dans Meta.' if t['category'] is None else ('À programmer.' if 'proposed:' in ' '.join(t['events']) and t['name'] != 'gml_affectation_chauffeur_fr' else '')
    if t.get('meta_review_note') and t['category']:
        note += ' Admissibilité à vérifier auprès de Meta.'
    lines.append(f"## {i}. {t['title']}\n\n**Nom :** `{t['name']}`  \n**Langue :** Français (`fr`)  \n**Destinataire :** {t['recipient']}\n\n")
    if note: lines.append(note.strip()+'\n\n')
    lines.append(f"**Contenu :**\n\n```text\n{t['body']}\n```\n\n**Exemples des variables :**\n\n")
    for p in t['parameters']:
        lines.append(f"- `{{{{{p['position']}}}}}` : {p['example']}\n")
    lines.append(f"\n**Exemple du message :**\n\n{t['example']}\n\n---\n\n")
    samples = ''.join(f"<li><code>{{{{{p['position']}}}}}</code> : {html.escape(p['example'])}</li>" for p in t['parameters'])
    cards.append(f'''<article><h2>{i}. {html.escape(t['title'])}</h2><p><b>Nom :</b> <code>{t['name']}</code><br><b>Langue :</b> Français (fr)<br><b>Destinataire :</b> {html.escape(t['recipient'])}</p>{('<p class="note">'+html.escape(note.strip())+'</p>') if note else ''}<h3>Contenu</h3><pre>{html.escape(t['body'])}</pre><button type="button">Copier le contenu</button><h3>Exemples des variables</h3><ul>{samples}</ul><h3>Exemple du message</h3><pre>{html.escape(t['example'])}</pre></article>''')
otp = '''## Code de connexion — à créer séparément

**Nom :** `gml_code_acces_fr`  
**Langue :** Français (`fr`)  
**Catégorie :** Authentification / Authentication  
**Contenu :** utiliser le texte et le bouton de code fournis par Meta dans son formulaire Authentication.  
**Exemple du code :** `123456`.

À programmer : le backend doit générer, vérifier et faire expirer le code. Ne pas créer un modèle Utility pour un code de sécurité.
'''
lines.append(otp)
(root/'whatsapp-template-pack.fr.md').write_text(''.join(lines), encoding='utf-8')
page = '''<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GM Fleet — modèles WhatsApp</title><style>*{box-sizing:border-box}body{overflow-wrap:anywhere;margin:0;background:#f3f6f7;color:#193244;font:16px/1.6 system-ui,sans-serif}main{max-width:850px;margin:auto;padding:28px 18px}article{background:white;border:1px solid #dbe3e7;border-radius:12px;padding:24px;margin:24px 0}h2{font-size:22px}h3{font-size:16px;margin-bottom:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6f7;padding:16px;font:inherit;border-radius:8px}code{overflow-wrap:anywhere}button{background:#193244;color:white;padding:10px 16px;border:0;border-radius:6px;cursor:pointer}.note{color:#87551a}a{color:inherit}@media print{button{display:none}article{break-inside:avoid}}</style><main><h1>GM Fleet — modèles WhatsApp</h1><p>Copier le nom, sélectionner <b>Français (fr)</b>, puis coller le contenu. Catégorie proposée : <b>Utility / Utilitaire</b>. Aucun en-tête, bouton ou pied de page requis.</p><p>Les exemples sont fictifs. Le backend est raccordé ; l’activation attend les tests réels de réception. « À programmer » signifie que le déclenchement reste à développer. Les SMS continuent.</p><p><a href="whatsapp-secrets-guide.fr.md">Guide des secrets</a> · <a href="whatsapp-notification-coverage.fr.md">Couverture des notifications</a></p>'''
page += ''.join(cards)
page += '<article><h2>Code de connexion</h2><p><b>Nom :</b> <code>gml_code_acces_fr</code><br><b>Langue :</b> Français (fr)<br><b>Catégorie :</b> Authentication</p><p>Utiliser le texte et le bouton de code fournis par Meta. Exemple : <code>123456</code>. Le backend OTP reste à programmer.</p></article></main><script>document.querySelectorAll("article button").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.previousElementSibling.textContent);b.textContent="Copié"}catch{b.textContent="Sélectionnez le contenu et copiez-le"}})</script></html>'
(root/'whatsapp-template-pack.fr.html').write_text(page, encoding='utf-8')
coverage=['# Couverture des notifications GM Fleet\n\nLe catalogue contient '+str(len(templates))+' messages, plus un modèle Authentication à configurer dans Meta. Aucun raccordement WhatsApp n’est encore actif. Les événements proposés ne sont pas des fonctions déjà déployées.\n\n| Notification | Destinataire | État |\n|---|---|---|\n']
for t in templates:
    coverage.append(f"| {t['title']} | {t['recipient']} | {t['status']} |\n")
coverage.append('\nLes propriétaires reçoivent leur affectation, les informations convenues sur leurs avances et leur paiement mensuel effectivement payé. Ils ne reçoivent pas chaque versement du chauffeur. Eric Ebabi reçoit les alertes de caisse. La case de notification reste respectée pour les rendez-vous. Les alertes GPS/caméra nécessitent des données et déclencheurs réellement fournis par GML Mobile ; une caméra seule ne permet pas d’identifier automatiquement les personnes.\n\n[Politique officielle WhatsApp](https://whatsappbusiness.com/policy/) : recouvrement par WhatsApp interdit ; conserver ce message en SMS.\n')
(root/'whatsapp-notification-coverage.fr.md').write_text(''.join(coverage),encoding='utf-8')
print(f'{len(templates)} notifications + Authentication; simple HTML, Markdown and coverage generated.')
