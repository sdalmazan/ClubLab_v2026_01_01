async function main() {
  const url = "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&CodJornada=1";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      "Referer": "https://www.rfcylf.es/pnfg/NPcd/NFG_VisCompeticiones?cod_primaria=1000120",
    },
  });

  console.log("Status:", res.status);
  const text = await res.text();
  console.log("HTML length:", text.length);
  console.log("Snippet:", text.substring(0, 300));
}

main().catch(console.error);
