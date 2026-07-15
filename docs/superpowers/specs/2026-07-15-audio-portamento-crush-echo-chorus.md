# Ljud: portamento, bitcrush, eko och chorus

**Datum:** 2026-07-15
**Status:** Implementerad

## Bakgrund

TODO.md listade fyra "tyngre" ljudeffekter som diskuterats men inte byggts när
de enklare (bend/vibrato/tremolo/pulsbredd/arpeggio) implementerades:
portamento, bitcrush/distortion, eko/delay och detune/chorus. Det här är de
fyra, klara — i `AudioManager` (`frontend/js/audio.js`) och som redigerbara
flaggor i `frontend/music-editor.html`, samma mönster som alla tidigare
effekter. Vid implementationen applicerades inget på den faktiska
"Froggy Hop"-låten; senare samma dag sprinklades alla fyra in i LEAD
(se "Applicering i låten" nedan).

## Omfattning

`frontend/js/audio.js` (`AudioManager`) och `frontend/music-editor.html`
(inspektorpanelen + editorns egna förhandslyssningssyntes). Inga ändringar av
export-/importformatets grundstruktur — fyra nya valfria fält på notobjekt:
`porta`, `crush`, `echo`, `chorus` (alla booleska).

## Portamento (`note.porta`)

Skild från befintlig `bend` (som glider mot en godtycklig målfrekvens inom
samma not och sedan släpper som vanligt): en riktig legato-glidning som
fortsätter obruten in i nästa nots attack, utan ny retrigger.

Arkitekturellt kräver detta att SAMMA oscillator/envelope spänner över två
noter istället för att varje not får sin egen — annars blir det aldrig en
riktig obruten glidning. Både `AudioManager._scheduler()` och editorns
`scheduleTrackNotes()` peekar därför på nästa not i sekvensen/spåret innan de
schemalägger en `porta`-flaggad not:

- Om nästa not är en riktig ton (inte paus/tomrum) och — i editorn — börjar
  exakt där den här notens längd tar slut (inget mellanrum), slås de två
  ihop till en enda schemaläggning (`_schedulePortamentoTone` /
  `schedulePortamentoTone`): en oscillator med `dur + nextDur` som total
  längd, ett enda attack/release-envelope, och en frekvensramp som börjar
  60 % in i den första noten och landar på den andra notens tonhöjd strax
  efter gränsen (`min(nextDur * 0.3, 0.12)` s in i den andra).
- Den "absorberade" nästa noten hoppar över sin egen schemaläggning helt —
  dess egna effektflaggor (bend/vib/trem/duty/arp) tillämpas inte; bara den
  gliddande notens egna `vib`/`trem`/`duty` gäller över hela den
  sammanslagna längden.
- I `AudioManager` avancerar schemaläggarens `voice.index`/`voice.nextAt` med
  båda noternas längd/index på en gång (hoppar över den absorberade notens
  eget varv i loopen). I editorn sorteras spårets noter på starttid först
  (de är inte garanterat lagrade i tidsordning), och loopen hoppar över
  index `i+1` när den absorberats.
- `bend` och `arp` är ömsesidigt uteslutande med `porta` i inspektorn (att
  sätta en av dem nollställer de andra två) — samma mönster som bend/arp
  redan uteslöt varandra.

Verifierat i headless Chromium genom att hooka
`OscillatorNode.prototype.start/stop`: två efterföljande noter (1/8-del
vardera vid 150 bpm, 0.2 s var) resulterar i exakt ett start/stop-par som
spänner 0.4 s när `porta` är satt på den första — och två separata par (0.2 s
vardera) när den inte är det.

## Bitcrush (`note.crush`)

En `WaveShaperNode` med en kvantiseringskurva (16 nivåer, ~4-bitars
upplösning) kopplas in mellan notens gain-nod och destinationen när
`note.crush` är satt — ett riktigt bitcrush/nedsamplings-ljud (blockig,
kantig vågform) snarare än mjuk distortion, för att passa 8-bitstemat.
Kurvan cachas (`_bitcrushCurve()` / `bitcrushCurve()`) eftersom den bara
beror på en fast, hårdkodad kvantiseringsgrad.

## Eko (`note.echo`)

En delad feedback-`DelayNode`-slinga (`_delay`/`_delayFeedback`/`_delayWet`
i `AudioManager`, `delay`/`delayFeedback`/`delayWet` i editorn), inte en
permanent effekt på hela kanalen — bara enstaka `echo`-flaggade noter
skickas dit, i tillägg till sin vanliga (torra) anslutning. Fördröjningen är
en punkterad åttondel (`EIGHTH_SEC * 1.5`, ~0.3 s vid 150 bpm) med
feedback-gain 0.35 (2–3 avtagande upprepningar) och wet-gain 0.5 — en
klassisk rytmisk slaptillbaka-eko.

## Chorus (`note.chorus`)

En andra oscillator läggs till, detune:ad ±8 cent via oscillatorernas
inbyggda `detune`-parameter (inget behov av att duplicera
frekvensautomatiken manuellt — Web Audio kombinerar `frequency` (Hz) och
`detune` (cent) automatiskt), och delar samma envelope-gain-nod som
huvudoscillatorn — klassisk "supersaw"-teknik, fast med fyrkant/triangel.
Hoppas över när `arp` är aktivt (chip-ackordets snabba frekvenshoppande
gjorde det inte värt att duplicera över två oscillatorer för den här
omgången) — checkboxen går fortfarande att kryssa i men har ingen hörbar
effekt i det fallet, ingen hård UI-spärr byggd för den ovanliga
kombinationen.

## Editorns visuella markörer

Nya CSS-klasser på notrutorna, samma mönster som `bend`/`vib`/`trem`:
`.note.porta::after` (glyf "⌒", återanvänder `bend`s hörn eftersom de
utesluter varandra), `.note.crush` (prickig/pixlig bakgrund),
`.note.echo`/`.note.chorus` (subtil box-shadow-kant). Combinationer av
`trem`+`crush` (båda sätter `background-image`) eller `echo`+`chorus` (båda
sätter `box-shadow`) visar bara den senaste regelns markör — en känd, mindre
kosmetisk begränsning (ljudet fungerar korrekt oavsett, bara den visuella
indikeringen kan krocka).

## Applicering i låten

Alla fyra effekter sprinklades in i `LEAD` (samma speglade kryddfilosofi som
tremolo/pulsbredd/arpeggio — enstaka utvalda noter, aldrig ett genomgående
lager; stämma/bas lämnas odekorerade som tidigare):

- **Eko** på de tre "ensamma" toner som följs av paus, så studsen fyller
  tystnaden: väntetonerna D4 och B4 i takt 4 (halvkadensen) och grundtonen
  G4 först i takt 8 (finalen).
- **Chorus** på de hållna sluttonerna i takt 2 (B4) och takt 6 (D5) — de
  enda hållna takt-sluten som ännu saknade effekt, vilket ger mönstret
  takt 1/5 tremolo, takt 2/6 chorus, takt 3/7 vibrato — samt på slutnotens
  G4→D5-glid i takt 8, där den feldstämda dubbleringen följer med i bendet
  för ett tjockare avslut inför loopens omtag.
- **Portamento** på det sista fallande steget i takt 3 (G4) och takt 7 (A4):
  tonen glider legato, utan ny attack, ner i taktens hållna slutton
  (Fs4 resp. G4). Vibratot som tidigare låg på sluttonerna flyttades till
  porta-noterna — den absorberade notens egna flaggor ignoreras vid
  sammanslagningen (se `_schedulePortamentoTone`), så flaggan hade annars
  blivit död data; nu gäller vibratot över hela den sammanslagna glidtonen.
- **Bitcrush** på de två speglade topptonerna (G5 i takt 2, B5 i takt 6, båda
  redan med 25 % pulsbredd) som ett kort grus-accent i klimaxen, samt på
  D4-chip-ackordet i takt 8 — kvantiserat brutet ackord är ett klassiskt
  smutsigt NES-sound för finalen.

## Testning

Ingen automatiserad testsvit (samma begränsning som resten av ljud-/
editorkoden). Verifierat via headless Chromium (Playwright):

1. Alla fyra flaggor kan sättas via `AudioManager._scheduleTone`/
   `_schedulePortamentoTone` direkt, inklusive kombinationer
   (crush+echo+chorus samtidigt, chorus+arp som ska ge tyst no-op) — inga fel.
2. `_scheduler()`s portamento-sammanslagning verifierad end-to-end med en
   anpassad röst: två sammanslagna noter (0.4+0.4 s) ger ett enda
   start/stop-par (0–0.8 s), följt av nästa (icke-porta) not som startar
   exakt vid 0.8 s — bekräftar korrekt index-/tidsavancemang genom hela
   schemaläggaren.
3. Editorns inspektor: kryssrutor för Portamento/Bitcrush/Echo/Chorus sätter
   rätt klasser på noten; att sätta Bend eller Arpeggio nollställer
   Portamento (och tvärtom).
4. Editorns `scheduleTrackNotes()`-sammanslagning verifierad på samma sätt
   som (2) — ett bas-spår med två anslutande noter, `porta` på/av, gav
   exakt förväntat antal oscillator-start/stop-par.
5. Export-rundturen (`JSON.stringify`-jämförelse mot befintlig
   `LEAD`/`HARMONY`/`BASS`/`RHYTHM`, som inte använder de nya flaggorna)
   fortfarande exakt likadan.
6. Backend-testsviten (132 tester) opåverkad.

## Explicit utanför scope

- Portamento absorberar bara EN efterföljande not, inte kedjor av flera
  `porta`-flaggade noter i rad (skulle kräva en mer generell "samla ihop N
  noter"-algoritm) — täcker det vanliga fallet (en glidning mellan två
  toner) men inte längre glissando-kedjor.
- Ingen kontinuerlig "amount"-parameter för bitcrush eller chorus-djup —
  båda är fasta, hårdkodade nivåer (matchar hur `arp`/`vib`/`trem` redan är
  fasta djup/hastigheter, inte per-not-justerbara).
- Ingen hård UI-spärr mot chorus+arp-kombinationen (se ovan) — checkboxen
  kan kryssas i utan effekt istället för att låsas/nollställas.
