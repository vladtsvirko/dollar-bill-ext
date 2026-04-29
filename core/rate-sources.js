const RateSources = (() => {
  const RATE_SOURCES = {
    nbrb: {
      name: 'National Bank of Belarus',
      fetchBaseRates: async () => {
        const resp = await fetch('https://api.nbrb.by/exrates/rates?periodicity=0');
        if (!resp.ok) throw new Error(`NBRB API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { BYN: { rate: 1, amount: 1 } };
        for (const item of data) {
          rates[item.Cur_Abbreviation] = { rate: item.Cur_OfficialRate, amount: item.Cur_Scale };
        }
        return { base: 'BYN', rates };
      },
    },
    ecb: {
      name: 'European Central Bank',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
        if (!resp.ok) throw new Error(`ECB API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { EUR: { rate: 1, amount: 1 } };
        const re = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const val = parseFloat(match[2]);
          rates[match[1]] = { rate: val, amount: 1 };
        }
        return { base: 'EUR', rates, indirect: true };
      },
    },
    nbp: {
      name: 'National Bank of Poland',
      fetchBaseRates: async () => {
        const resp = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/');
        if (!resp.ok) throw new Error(`NBP API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { PLN: { rate: 1, amount: 1 } };
        if (Array.isArray(data) && data[0] && data[0].rates) {
          for (const item of data[0].rates) {
            rates[item.code] = { rate: item.mid, amount: 1 };
          }
        }
        return { base: 'PLN', rates };
      },
    },
    nbu: {
      name: 'National Bank of Ukraine',
      fetchBaseRates: async () => {
        const today = new Date();
        const dateStr = `${String(today.getFullYear())}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const resp = await fetch(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json&date=${dateStr}`);
        if (!resp.ok) throw new Error(`NBU API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { UAH: { rate: 1, amount: 1 } };
        for (const item of data) {
          rates[item.cc] = { rate: item.rate, amount: 1 };
        }
        return { base: 'UAH', rates };
      },
    },
    cbr: {
      name: 'Bank of Russia',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.cbr.ru/scripts/XML_daily_eng.asp');
        if (!resp.ok) throw new Error(`CBR API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { RUB: { rate: 1, amount: 1 } };
        const re = /<CharCode>([A-Z]{3})<\/CharCode>\s*<Nominal>(\d+)<\/Nominal>\s*<Name>[^<]*<\/Name>\s*<Value>([\d.,]+)<\/Value>/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, nominal, value] = match;
          rates[code] = { rate: parseFloat(value.replace(',', '.')), amount: parseInt(nominal, 10) };
        }
        return { base: 'RUB', rates };
      },
    },
    cnb: {
      name: 'Czech National Bank',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.xml');
        if (!resp.ok) throw new Error(`CNB API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { CZK: { rate: 1, amount: 1 } };
        const re = /<radek\s[^>]*kod="([A-Z]{3})"[^>]*mnozstvi="(\d+)"[^>]*kurz="([\d.,]+)"/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, amount, rate] = match;
          rates[code] = { rate: parseFloat(rate.replace(',', '.')), amount: parseInt(amount, 10) };
        }
        return { base: 'CZK', rates };
      },
    },
    tcmb: {
      name: 'Central Bank of Turkey',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml');
        if (!resp.ok) throw new Error(`TCMB API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { TRY: { rate: 1, amount: 1 } };
        const re = /<Currency\s[^>]*CurrencyCode="([A-Z]{3})"[^>]*>[\s\S]*?<Unit>(\d+)<\/Unit>[\s\S]*?<ForexBuying>([\d.,]+)<\/ForexBuying>/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, unit, buying] = match;
          rates[code] = { rate: parseFloat(buying.replace(',', '.')), amount: parseInt(unit, 10) };
        }
        return { base: 'TRY', rates };
      },
    },
    boc: {
      name: 'Bank of Canada',
      fetchBaseRates: async () => {
        const d = new Date();
        d.setDate(d.getDate() - 5);
        const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const series = 'FXUSDCAD,FXEURCAD,FXJPYCAD,FXCHFCAD,FXGBPCAD,FXAUDCAD,FXBRLCAD,FXCNYCAD,FXHKDCAD,FXINRCAD,FXIDRCAD,FXMXNCAD,FXNZDCAD,FXNOKCAD,FXPENCAD,FXRUBCAD,FXSARCAD,FXSGDCAD,FXZARCAD,FXKRWCAD,FXSEKCAD,FXTWDCAD,FXTRYCAD';
        const resp = await fetch(`https://www.bankofcanada.ca/valet/observations/${series}/json?start_date=${startDate}`);
        if (!resp.ok) throw new Error(`BOC API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { CAD: { rate: 1, amount: 1 } };
        const observations = data.observations;
        if (!observations || observations.length === 0) {
          throw new Error('BOC API: no observations returned');
        }
        // Use latest observation
        const latest = observations[observations.length - 1];
        for (const [key, val] of Object.entries(latest)) {
          if (key === 'd') continue;
          // Series names like FXUSDCAD, FXEURCAD — strip FX prefix and CAD suffix
          const match = key.match(/^FX([A-Z]{3})CAD$/);
          if (match && val && val.v) {
            // FXUSDCAD = 1 USD in CAD, so rate for USD in CAD base = val.v
            rates[match[1]] = { rate: parseFloat(val.v), amount: 1 };
          }
        }
        return { base: 'CAD', rates };
      },
    },
    bcb: {
      name: 'Central Bank of Brazil',
      fetchBaseRates: async () => {
        const rates = { BRL: { rate: 1, amount: 1 } };
        // Try up to 5 previous days to handle weekends/holidays
        for (let daysBack = 0; daysBack < 5; daysBack++) {
          const d = new Date();
          d.setDate(d.getDate() - daysBack);
          const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
          const resp = await fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao='${dateStr}')?$top=100&$format=json`);
          if (!resp.ok) continue;
          const data = await resp.json();
          if (data.value && data.value.length > 0) {
            const cotacao = data.value[0];
            rates.USD = { rate: cotacao.cotacaoCompra, amount: 1 };
            return { base: 'BRL', rates, rateDate: cotacao.dataHoraCotacao };
          }
        }
        throw new Error('BCB: no rates available for the last 5 days');
      },
    },
    boe: {
      name: 'Bank of England',
      fetchBaseRates: async () => {
        // BOE retired their IADB API. Using Frankfurter (ECB reference rates) for GBP rates.
        // Frankfurter returns indirect format (1 GBP = X foreign).
        const resp = await fetch('https://api.frankfurter.app/latest?from=GBP');
        if (!resp.ok) throw new Error(`BOE API error: ${resp.status}`);
        const data = await resp.json();
        if (!data || typeof data.rates !== 'object') throw new Error('BOE API: invalid response');
        const rates = { GBP: { rate: 1, amount: 1 } };
        for (const [code, val] of Object.entries(data.rates)) {
          rates[code] = { rate: val, amount: 1 };
        }
        return { base: 'GBP', rates, indirect: true };
      },
    },
    hkma: {
      name: 'Hong Kong Monetary Authority',
      fetchBaseRates: async () => {
        const resp = await fetch('https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?offset=0&pagesize=1');
        if (!resp.ok) throw new Error(`HKMA API error: ${resp.status}`);
        const data = await resp.json();
        const records = data && data.result && data.result.records;
        if (!records || records.length === 0) throw new Error('HKMA API: no records returned');
        const latest = records[0];
        const rates = { HKD: { rate: 1, amount: 1 } };
        const fieldMap = {
          usd: 'USD', gbp: 'GBP', jpy: 'JPY', cad: 'CAD', aud: 'AUD',
          sgd: 'SGD', twd: 'TWD', chf: 'CHF', cny: 'CNY', krw: 'KRW',
          thb: 'THB', myr: 'MYR', eur: 'EUR', php: 'PHP', inr: 'INR',
          idr: 'IDR', zar: 'ZAR',
        };
        for (const [field, code] of Object.entries(fieldMap)) {
          const val = latest[field];
          if (val != null) rates[code] = { rate: parseFloat(val), amount: 1 };
        }
        return { base: 'HKD', rates };
      },
    },
    nbk: {
      name: 'National Bank of Kazakhstan',
      fetchBaseRates: async () => {
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
        const resp = await fetch(`https://nationalbank.kz/rss/get_rates.cfm?fdate=${dateStr}`);
        if (!resp.ok) throw new Error(`NBK API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { KZT: { rate: 1, amount: 1 } };
        const re = /<item>\s*<fullname>[^<]*<\/fullname>\s*<title>([A-Z]{3})<\/title>\s*<description>([\d.]+)<\/description>\s*<quant>(\d+)<\/quant>/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, rate, quant] = match;
          rates[code] = { rate: parseFloat(rate), amount: parseInt(quant, 10) };
        }
        return { base: 'KZT', rates };
      },
    },
  };

  function getSourceDisplayName(sourceId) {
    const source = RATE_SOURCES[sourceId];
    return source ? source.name : sourceId;
  }

  return { RATE_SOURCES, getSourceDisplayName };
})();
