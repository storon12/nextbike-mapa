// Text metodiky převzatý z původní aplikace (EKO_MODEL/eko_ui.py).
export default function Methodology() {
  return (
    <details className="method">
      <summary>Metodika výpočtu</summary>
      <div className="method-body">
        <p>
          Model kvantifikuje socioekonomické přínosy (pozitivní externality) systému sdílených kol Nextbike. Syntetizuje provozní data,
          ukazatele ČR a závěry studie společnosti EY a Cycling Industries Europe (2025).
        </p>

        <h3>Nákladový model financování (platby města)</h3>
        <p>
          Aplikace umí přepínat mezi třemi druhy dotačních politik. U paušálu se fixní náklady rozpočítají do jednotlivých dnů provozu, aby šlo
          určit časový bod zlomu, kdy vygenerované společenské úspory převýší investici z veřejného rozpočtu.
        </p>

        <h3>Podpora lokálního maloobchodu a bezpečnost</h3>
        <ul>
          <li>
            <b>Lokální maloobchod:</b> Studie Evropské cyklistické federace (ECF, <i>The benefits of cycling</i>) ukazuje, že uživatelé aktivní
            mobility utrácejí v lokálních obchodech v přepočtu na metr čtvereční plochy až 5× více než řidiči aut. Chodci a cyklisté „nakupují
            očima“, protože jsou v přímém kontaktu s výlohami a snadno zastaví. Model tuto externalitu cení na 1,50 Kč za jízdu, která nahradila
            přesun autem nebo MHD.
          </li>
          <li>
            <b>Bezpečnost (eyes on the street):</b> Studie <i>The safety of bike-share systems</i> (Fishman & Schepers, OECD 2018) ukazuje
            zvýšení pasivní bezpečnosti. Přítomnost sdílených kol na ulicích snižuje vandalismus a sociálně-patologické jevy díky neformálnímu
            dohledu nad veřejným prostorem. Hodnota je stanovena na 1,50 Kč za každou výpůjčku.
          </li>
        </ul>

        <h3>Čištění dat a pravidlo 5 km</h3>
        <p>
          V reálném provozu dochází k chybám měření. Průměrná délka městské výpůjčky je do 3,8 km. Vzdálenost jízdy se počítá jako vzdušná
          čára × 1,3 a každá jízda se ořízne na nejvýš 5 km: výpůjčka zůstane započítaná, ale do ujeté vzdálenosti jde maximálně 5 km. Jízdy
          bez cílové polohy se počítají jako výpůjčka bez ujetých km a nespuštěné výpůjčky (příznak <i>invalid</i>) se vyřazují.
        </p>

        <h3>Hodnota lidského času (VOT)</h3>
        <p>
          Model porovnává čas na sdíleném kole s chůzí u uživatelů, kteří kolem nahradili pěší přesun. Při rychlosti chůze 4 km/h a kola 12 km/h
          je úspora na kilometr 1/4 − 1/12 = 1/6 hodiny, tedy asi 10 minut na každý km. Ušetřený čas je oceněn podle konceptu <i>value of
          time</i>; základ (100 %) vychází z hrubé hodinové mzdy v ČR 320 Kč/h. Posuvníkem lze váhu času měnit od 0 do 200 %.
        </p>

        <h3>Lokální zaměstnanost a flexibilita</h3>
        <ul>
          <li>
            <b>Práce:</b> Provoz sítě (rebalance a servis) vytváří lokální pracovní místa. Modelové město o cca 30 000 obyvatelích s flotilou 100
            kol a 400 výpůjčkami denně potřebuje jednoho stálého technika. Při hrubé mzdě 35 000 Kč měsíčně to dělá 2,90 Kč na každou jízdu.
          </li>
          <li>
            <b>Flexibilita (option value):</b> Hodnota samotné dostupnosti dopravní alternativy pro nečekané situace (výpadek MHD, porucha
            auta). Oceněna konzervativně na 0,50 Kč za jízdu.
          </li>
        </ul>

        <h3>Přímé úspory občanů</h3>
        <ul>
          <li>
            <b>Místo vlastního kola (1,50 Kč/km):</b> Uživatel nemusí platit servis a nenese riziko ztráty hodnoty či krádeže kola. Platí jen pro
            podíl kilometrů „místo vlastního kola“.
          </li>
          <li>
            <b>Místo auta (6,50 Kč/km):</b> Úspora za palivo, provozní kapaliny, pneumatiky a opotřebení vozu. Platí pro podíl kilometrů „místo
            auta“.
          </li>
        </ul>

        <h3>Multimodalita, zdraví a ovzduší (EY 2025)</h3>
        <ul>
          <li>
            <b>Synergie s MHD:</b> Až 55 % uživatelů kombinuje sdílené kolo s MHD. Když kolo nahradí auto, stává se součástí udržitelného
            dopravního řetězce a zvyšuje tržby veřejné dopravy. Oceněno 1,00 Kč za každou jízdu, která nahradila auto.
          </li>
          <li>
            <b>Zdraví (0,94 Kč/km):</b> Pravidelná fyzická aktivita jako prevence kardiovaskulárních chorob, diabetu 2. typu a dalších
            civilizačních onemocnění.
          </li>
          <li>
            <b>Ovzduší (0,24 Kč/km):</b> Ušetřené emise skleníkových plynů (CO₂e) a prachových částic (PM10, NOx) z provozu aut. Počítá se
            pro přesuny, které nahradily auto nebo MHD.
          </li>
        </ul>
      </div>
    </details>
  )
}
