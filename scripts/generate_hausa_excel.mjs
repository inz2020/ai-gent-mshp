/**
 * Genere le fichier Excel du vocabulaire Hausa (avec traduction francaise).
 * Executer avec : node scripts/generate_hausa_excel.mjs
 */

import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Raccourci : type, valeur hausa, traduction francaise, categorie
const m = (valeur, traduction_fr, categorie) => ({ type: 'mot',    valeur, traduction_fr, categorie });
const p = (valeur, traduction_fr, categorie) => ({ type: 'phrase', valeur, traduction_fr, categorie });

// ═══════════════════════════════════════════════════════
// MOTS HAUSA + traduction francaise
// ═══════════════════════════════════════════════════════
const MOTS = [
    // Vaccination
    m('rigakafi',           'vaccin',                           'vaccination'),
    m('allurar',            'injection / piqure',               'vaccination'),
    m('allurar rigakafi',   'piqure de vaccin',                 'vaccination'),
    m('allon',              'carnet / plaquette',               'vaccination'),
    m('allura',             'seringue / injection',             'vaccination'),
    m('bcg',                'BCG (tuberculose)',                 'vaccination'),
    m('polio',              'poliomyelite',                     'vaccination'),
    m('pentavalent',        'vaccin pentavalent',               'vaccination'),
    m('pneumocoque',        'vaccin pneumocoque',               'vaccination'),
    m('rotavirus',          'vaccin rotavirus',                 'vaccination'),
    m('kyanda',             'rougeole',                         'vaccination'),
    m('meningitis',         'meningite',                        'vaccination'),
    m('vat',                'vaccin antitetanique (VAT)',        'vaccination'),
    m('menafrica',          'MenAfriVac (meningite A)',          'vaccination'),
    m('rigakafin',          'vaccination / vacciner',           'vaccination'),
    m('dose',               'dose',                             'vaccination'),
    m('allurar kyanda',     'vaccin contre la rougeole',        'vaccination'),
    m('allurar polio',      'vaccin contre la polio',           'vaccination'),
    m('allurar vat',        'vaccin VAT (tetanos)',              'vaccination'),
    // Structures de sante
    m('asibiti',            'hopital',                          'structure_sante'),
    m('cibiyar lafiya',     'centre de sante (CSI)',            'structure_sante'),
    m('cibiya',             'centre / etablissement',           'structure_sante'),
    m('likita',             'medecin / docteur',                'structure_sante'),
    m('ungozoma',           'sage-femme',                       'structure_sante'),
    m('csi',                'centre de sante integre',          'structure_sante'),
    m('pev',                'Programme Elargi de Vaccination',  'structure_sante'),
    // Famille / personnes
    m('jariri',             'nourrisson / bebe',                'famille'),
    m('jarma',              'nourrisson',                       'famille'),
    m('yaro',               'enfant garcon',                    'famille'),
    m('yarinya',            'enfant fille',                     'famille'),
    m('uwa',                'mere',                             'famille'),
    m('uba',                'pere',                             'famille'),
    m('mai ciki',           'femme enceinte',                   'famille'),
    m('yara',               'enfants',                          'famille'),
    m('haihuwa',            'accouchement / naissance',         'famille'),
    m('ciki',               'grossesse / ventre',               'famille'),
    m('mama',               'maman',                            'famille'),
    m('dan',                'fils / enfant de',                 'famille'),
    // Symptomes / maladies
    m('zazzabi',            'fievre',                           'symptome'),
    m('tari',               'toux',                             'symptome'),
    m('gudawa',             'diarrhee',                         'symptome'),
    m('amai',               'vomissement',                      'symptome'),
    m('ciwon kai',          'mal de tete',                      'symptome'),
    m('ciwon ciki',         'mal au ventre',                    'symptome'),
    m('ciwon jiki',         'douleur corporelle',               'symptome'),
    m('rauni',              'blessure / douleur',               'symptome'),
    m('kasala',             'fatigue',                          'symptome'),
    m('zafin jiki',         'chaleur corporelle / fievre',      'symptome'),
    m('malariya',           'paludisme / malaria',              'symptome'),
    m('numfashi',           'respiration',                      'symptome'),
    m('farfadiya',          'convulsion / epilepsie',           'symptome'),
    m('jini',               'sang',                             'symptome'),
    m('cuta',               'maladie',                          'symptome'),
    m('rashin lafiya',      'etre malade / maladie',            'symptome'),
    m('ciwo',               'douleur / maladie',                'symptome'),
    m('kwayar cuta',        'microbe / pathogene',              'symptome'),
    m('diphtheria',         'diphtherie',                       'symptome'),
    m('tetanus',            'tetanos',                          'symptome'),
    m('korau',              'oreillons / parotidite',           'symptome'),
    // Medicaments / traitements
    m('magani',             'medicament / remede',              'medicament'),
    m('kwaya',              'comprimes / medicament',           'medicament'),
    m('paracetamol',        'paracetamol',                      'medicament'),
    m('zinc',               'zinc',                             'medicament'),
    m('sro',                'solution de rehydratation orale',  'medicament'),
    m('ruwan sukari',       'eau sucree',                       'medicament'),
    m('ruwan gishiri',      'eau salee',                        'medicament'),
    // Sante generale
    m('lafiya',             'sante / aller bien',               'sante'),
    m('kiwon lafiya',       'soins de sante',                   'sante'),
    m('nono',               'sein / lait maternel',             'sante'),
    m('shayarwa',           'allaitement maternel',             'sante'),
    m('abinci',             'nourriture / aliment',             'sante'),
    m('ruwa',               'eau',                              'sante'),
    m('sauro',              'moustique',                        'sante'),
    m('malamarta',          'moustiquaire',                     'sante'),
    m('tsaftar jiki',       'hygiene corporelle',               'sante'),
    m('kyauta',             'gratuit',                          'sante'),
    m('gaggawa',            'urgence',                          'sante'),
    m('mataki',             'etape / mesure',                   'sante'),
    // Interrogatifs / adverbes
    m('yaushe',             'quand',                            'interrogatif'),
    m('wane',               'lequel / quel',                    'interrogatif'),
    m('nawa',               'combien',                          'interrogatif'),
    m('yaya',               'comment',                          'interrogatif'),
    m('me',                 'quoi / que',                       'interrogatif'),
    m('wanda',              'qui / lequel',                     'interrogatif'),
    m('yanzu',              'maintenant',                       'adverbe'),
    m('yau',                'aujourd hui',                      'adverbe'),
    m('gobe',               'demain',                           'adverbe'),
    m('jiya',               'hier',                             'adverbe'),
    m('wata',               'mois / lune',                      'adverbe'),
    m('mako',               'semaine',                          'adverbe'),
    m('shekara',            'annee',                            'adverbe'),
    m('kadan',              'un peu / peu',                     'adverbe'),
    m('sosai',              'beaucoup / tres',                  'adverbe'),
    m('nan da nan',         'immediatement',                    'adverbe'),
    m('daga baya',          'plus tard / apres',                'adverbe'),
];

// ═══════════════════════════════════════════════════════
// PHRASES HAUSA + traduction francaise
// ═══════════════════════════════════════════════════════
const PHRASES = [
    // Salutations
    p('ina kwana',                                          'bonjour (matin)',                                       'salutation'),
    p('ina wuni',                                           'bonjour (apres-midi)',                                  'salutation'),
    p('barka da safe',                                      'bonne matinee',                                        'salutation'),
    p('barka da rana',                                      'bonne journee',                                        'salutation'),
    p('barka da yamma',                                     'bonne soiree',                                         'salutation'),
    p('ina lafia',                                          'comment vas-tu (je vais bien)',                         'salutation'),
    p('lafiya lau',                                         'tres bien (reponse)',                                   'salutation'),
    p('sannu da aiki',                                      'bon courage au travail',                               'salutation'),
    p('na gode',                                            'merci',                                                'salutation'),
    p('don allah',                                          's il vous plait',                                      'salutation'),
    p('assalamu alaikum',                                   'paix sur vous (salutation islamique)',                  'salutation'),
    p('wa alaikum salam',                                   'et sur vous la paix (reponse)',                         'salutation'),
    // Vaccination — questions courantes
    p('yaushe ake yi wa jariri allurar rigakafi',           'quand vacciner le nourrisson',                         'vaccination'),
    p('ina cibiyar rigakafi kusa da ni',                    'ou est le centre de vaccination pres de moi',          'vaccination'),
    p('rigakafi kyauta ne a cibiyar lafiya',                'le vaccin est gratuit au centre de sante',             'vaccination'),
    p('ina son yi wa yaro allurar rigakafi',                'je veux vacciner mon enfant',                          'vaccination'),
    p('an rasa allon rigakafi me za a yi',                  'on a rate le vaccin que faire',                        'vaccination'),
    p('yaro bai yi ba allurar rigakafi',                    'l enfant n a pas eu son vaccin',                       'vaccination'),
    p('wane rigakafi ne jariri ya kamata ya yi',            'quel vaccin le nourrisson doit-il recevoir',           'vaccination'),
    p('allurar kyanda sau biyu ne',                         'le vaccin rougeole se fait en deux doses',             'vaccination'),
    p('allurar bcg yana a kafar hagu',                      'le BCG se fait sur l epaule gauche',                   'vaccination'),
    p('yaro ya yi rigakafi na farko',                       'l enfant a recu son premier vaccin',                   'vaccination'),
    p('rigakafin polio ana sha ba a allura',                'le vaccin polio se prend par la bouche',               'vaccination'),
    p('rigakafi da yawa ana yi a rana daya ba shi da cutarwa', 'plusieurs vaccins le meme jour c est sans danger', 'vaccination'),
    p('yaro yana rashin lafiya za a iya yi masa allurar',   'l enfant est malade peut-on le vacciner quand meme',   'vaccination'),
    p('kai jariri cibiyar lafiya don rigakafi',             'amene le nourrisson au centre pour le vaccin',         'vaccination'),
    p('kada a fara daga farko idan an rasa allon',          'on ne recommence pas depuis le debut si on a rate',    'vaccination'),
    // Reactions post-vaccin
    p('yaro ya yi zazzabi bayan allurar rigakafi',          'l enfant a de la fievre apres le vaccin',              'vaccination'),
    p('wurin da aka yi allura ya kumbura',                  'le site d injection a gonfle',                         'vaccination'),
    p('yaro yana kuka bayan allurar',                       'l enfant pleure apres la piqure',                      'vaccination'),
    p('zazzabi kadan bayan rigakafi al ada ne',             'une legere fievre apres le vaccin est normale',        'vaccination'),
    p('ba da paracetamol idan zazzabi ya yi yawa',          'donner du paracetamol si la fievre est forte',         'vaccination'),
    p('idan zazzabi ya wuce kwana biyu je cibiyar',         'si la fievre dure plus de 2 jours aller au CSI',       'vaccination'),
    // Calendrier vaccinal
    p('a ranar haihuwa ana yi wa jariri bcg da polio',      'a la naissance BCG et polio oral',                     'calendrier'),
    p('mako shida allurar pentavalent ta farko',            'a 6 semaines premier pentavalent',                     'calendrier'),
    p('watanni tara allurar kyanda da zazzabin rawaya',     'a 9 mois rougeole et fievre jaune',                    'calendrier'),
    p('watanni goma sha biyar allurar kyanda ta biyu',      'entre 15 et 18 mois deuxieme vaccin rougeole',         'calendrier'),
    p('allurar vat ga mata masu ciki',                      'vaccin VAT pour les femmes enceintes',                 'calendrier'),
    p('allurar menafrica tsakanin watanni goma sha biyu',   'MenAfriVac entre 12 et 23 mois',                       'calendrier'),
    // Sante nourrisson
    p('jariri yana gudawa me za a yi',                      'le bebe a la diarrhee que faire',                      'nourrisson'),
    p('ba da ruwan sro jariri idan yana gudawa',            'donner du SRO au bebe en cas de diarrhee',             'nourrisson'),
    p('jariri yana tari da wahalar numfashi',               'le bebe tousse et a du mal a respirer',                'nourrisson'),
    p('yaro ya ki shan nono ko sha ruwa',                   'l enfant refuse le sein ou de boire',                  'nourrisson'),
    p('shayar da jariri nono har watanni shida',            'allaiter le bebe au sein jusqu a 6 mois',              'nourrisson'),
    p('nono na uwa shi ne abinci mafi kyau ga jariri',      'le lait maternel est le meilleur aliment pour le bebe','nourrisson'),
    p('jariri yana amai da yawa',                           'le bebe vomit beaucoup',                               'nourrisson'),
    p('yaro bai son ci abinci',                             'l enfant refuse de manger',                            'nourrisson'),
    p('jariri yana jin zazzabi',                            'le bebe a de la fievre',                               'nourrisson'),
    p('je cibiyar lafiya yanzu da jariri',                  'aller immediatement au centre de sante avec le bebe',  'nourrisson'),
    // Grossesse
    p('ina da ciki watanni nawa',                           'j ai combien de mois de grossesse',                    'grossesse'),
    p('mata masu ciki su je cibiyar lafiya sau takwas',     'les femmes enceintes doivent faire 8 visites prenatales','grossesse'),
    p('allurar vat na kare uwa da jariri daga tetanus',     'le VAT protege la mere et le bebe du tetanos',         'grossesse'),
    p('mai ciki tana zubar da jini je asibiti nan da nan',  'femme enceinte qui saigne aller a l hopital tout de suite','grossesse'),
    p('ciwon kai mai zafi a lokacin ciki gaggawa ne',       'fort mal de tete pendant la grossesse c est urgent',   'grossesse'),
    p('ina son sanin kiwon lafiya a lokacin ciki',          'je veux des informations sur la sante pendant la grossesse','grossesse'),
    // Urgences
    p('je asibiti nan da nan',                              'aller a l hopital immediatement',                      'urgence'),
    p('yaro ya fadi hankali gaggawa ne',                    'l enfant a perdu connaissance c est urgent',           'urgence'),
    p('yaro yana farfadiya je asibiti',                     'l enfant fait des convulsions aller a l hopital',      'urgence'),
    p('yaro yana wahalar numfashi nan da nan je cibiyar',   'l enfant a du mal a respirer aller au centre tout de suite','urgence'),
    p('yaro bai sha ruwa ba tsawon sa a kwana',             'l enfant n a pas bu depuis des heures',                'urgence'),
    p('akwai jini a cikin guda na jariri',                  'il y a du sang dans les selles du bebe',               'urgence'),
    p('wannan gaggawa ne kada a jira',                      'c est une urgence ne pas attendre',                    'urgence'),
    // Demandes d information
    p('ina bukatar taimako',                                'j ai besoin d aide',                                   'demande'),
    p('don allah taimaka ni',                               's il vous plait aidez-moi',                            'demande'),
    p('ina son sani',                                       'je veux savoir',                                       'demande'),
    p('me ya kamata na yi',                                 'que dois-je faire',                                    'demande'),
    p('yaya za a yi',                                       'comment faire',                                        'demande'),
    p('yaya ake yi',                                        'comment ca se fait',                                   'demande'),
    p('ina son sanin',                                      'je voudrais savoir',                                   'demande'),
    p('kina iya taimaka mini',                              'peux-tu m aider',                                      'demande'),
    // Paludisme
    p('yi amfani da malamarta kowace dare',                 'utiliser la moustiquaire chaque nuit',                 'paludisme'),
    p('sauro yana kawo zazzabin malariya',                  'le moustique transmet le paludisme',                   'paludisme'),
    p('je cibiyar idan yaro yana zazzabi don gwajin jini',  'aller au CSI si l enfant a de la fievre pour un test sanguin','paludisme'),
    p('kada a sha magani ba tare da gwaji ba',              'ne pas prendre de medicament sans test',               'paludisme'),
];

// ═══════════════════════════════════════════════════════
// GENERATION DU FICHIER
// ═══════════════════════════════════════════════════════

const allData = [...MOTS, ...PHRASES];

const ws = XLSX.utils.json_to_sheet(allData);
ws['!cols'] = [
    { wch: 8  },   // type
    { wch: 48 },   // valeur
    { wch: 48 },   // traduction_fr
    { wch: 16 },   // categorie
];
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'HausaVocab');

const outPath = path.join(__dirname, '..', 'hausa_vocabulaire_niger.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`Fichier genere : hausa_vocabulaire_niger.xlsx`);
console.log(`  ${MOTS.length} mots + ${PHRASES.length} phrases = ${allData.length} entrees`);
console.log(`  Colonnes : type | valeur (hausa) | traduction_fr | categorie`);
console.log('');
console.log('Importez depuis : Dashboard -> Metadonnees -> Vocabulaire Hausa -> Import Excel');
