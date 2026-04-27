const RatesUtil = (() => {
  const DEFAULT_CURRENCIES = {
    BYN: {
      name: 'Belarusian Ruble',
      symbol: 'BYN',
      identifiers: ['BYN', 'Br', 'бел. руб.', 'р. бел', 'руб.', 'р.', 'ƃ'],
      domains: ['.by', '.бел'],
    },
    RUB: {
      name: 'Russian Ruble',
      symbol: '₽',
      identifiers: ['RUB', '₽', 'руб.', 'р.'],
      domains: ['.ru', '.рф'],
    },
    USD: {
      name: 'US Dollar',
      symbol: '$',
      identifiers: ['USD', '$'],
      domains: [],
    },
    EUR: {
      name: 'Euro',
      symbol: '€',
      identifiers: ['EUR', '€'],
      domains: [],
    },
    PLN: {
      name: 'Polish Zloty',
      symbol: 'zł',
      identifiers: ['PLN', 'zł'],
      domains: ['.pl'],
    },
    UAH: {
      name: 'Ukrainian Hryvnia',
      symbol: '₴',
      identifiers: ['UAH', '₴', 'грн.'],
      domains: ['.ua'],
    },
    CZK: {
      name: 'Czech Koruna',
      symbol: 'Kč',
      identifiers: ['CZK', 'Kč'],
      domains: ['.cz'],
    },
    TRY: {
      name: 'Turkish Lira',
      symbol: '₺',
      identifiers: ['TRY', '₺', 'TL'],
      domains: ['.tr'],
    },
    CAD: {
      name: 'Canadian Dollar',
      symbol: 'CA$',
      identifiers: ['CAD', 'CA$', 'C$'],
      domains: ['.ca'],
    },
    BRL: {
      name: 'Brazilian Real',
      symbol: 'R$',
      identifiers: ['BRL', 'R$'],
      domains: ['.br'],
    },
    GBP: {
      name: 'British Pound',
      symbol: '£',
      identifiers: ['GBP', '£'],
      domains: ['.co.uk', '.uk'],
    },
    AED: {
      name: 'UAE Dirham',
      symbol: 'AED',
      identifiers: ['AED', 'Dh', 'د.إ'],
      domains: ['.ae'],
    },
    AFN: {
      name: 'Afghan Afghani',
      symbol: '؋',
      identifiers: ['AFN', '؋', 'Af'],
      domains: ['.af'],
    },
    ALL: {
      name: 'Albanian Lek',
      symbol: 'L',
      identifiers: ['ALL', 'Lek'],
      domains: ['.al'],
    },
    AMD: {
      name: 'Armenian Dram',
      symbol: '֏',
      identifiers: ['AMD', '֏', 'dram'],
      domains: ['.am'],
    },
    ANG: {
      name: 'Netherlands Antillean Guilder',
      symbol: 'ƒ',
      identifiers: ['ANG', 'ƒ', 'NAƒ'],
      domains: ['.cw', '.sx'],
    },
    AOA: {
      name: 'Angolan Kwanza',
      symbol: 'Kz',
      identifiers: ['AOA', 'Kz'],
      domains: ['.ao'],
    },
    ARS: {
      name: 'Argentine Peso',
      symbol: 'AR$',
      identifiers: ['ARS', 'AR$'],
      domains: ['.ar'],
    },
    AUD: {
      name: 'Australian Dollar',
      symbol: 'A$',
      identifiers: ['AUD', 'A$', 'AU$'],
      domains: [],
    },
    AWG: {
      name: 'Aruban Florin',
      symbol: 'ƒ',
      identifiers: ['AWG', 'Afl'],
      domains: ['.aw'],
    },
    AZN: {
      name: 'Azerbaijani Manat',
      symbol: '₼',
      identifiers: ['AZN', '₼', 'man.'],
      domains: ['.az'],
    },
    BAM: {
      name: 'Bosnia-Herzegovina Convertible Mark',
      symbol: 'KM',
      identifiers: ['BAM', 'KM', 'КМ'],
      domains: ['.ba'],
    },
    BBD: {
      name: 'Barbados Dollar',
      symbol: 'Bds$',
      identifiers: ['BBD', 'Bds$'],
      domains: ['.bb'],
    },
    BDT: {
      name: 'Bangladeshi Taka',
      symbol: '৳',
      identifiers: ['BDT', '৳', 'Tk'],
      domains: ['.bd'],
    },
    BGN: {
      name: 'Bulgarian Lev',
      symbol: 'лв',
      identifiers: ['BGN', 'лв', 'Lv'],
      domains: ['.bg'],
    },
    BHD: {
      name: 'Bahraini Dinar',
      symbol: 'BHD',
      identifiers: ['BHD', 'BD', 'د.ب'],
      domains: ['.bh'],
    },
    BIF: {
      name: 'Burundian Franc',
      symbol: 'FBu',
      identifiers: ['BIF', 'FBu'],
      domains: ['.bi'],
    },
    BMD: {
      name: 'Bermudian Dollar',
      symbol: 'BD$',
      identifiers: ['BMD', 'BD$'],
      domains: ['.bm'],
    },
    BND: {
      name: 'Brunei Dollar',
      symbol: 'B$',
      identifiers: ['BND', 'B$'],
      domains: ['.bn'],
    },
    BOB: {
      name: 'Bolivian Boliviano',
      symbol: 'Bs',
      identifiers: ['BOB', 'Bs'],
      domains: ['.bo'],
    },
    BSD: {
      name: 'Bahamian Dollar',
      symbol: 'B$',
      identifiers: ['BSD', 'B$'],
      domains: ['.bs'],
    },
    BTN: {
      name: 'Bhutanese Ngultrum',
      symbol: 'Nu',
      identifiers: ['BTN', 'Nu'],
      domains: ['.bt'],
    },
    BWP: {
      name: 'Botswana Pula',
      symbol: 'P',
      identifiers: ['BWP', 'P'],
      domains: ['.bw'],
    },
    BZD: {
      name: 'Belize Dollar',
      symbol: 'BZ$',
      identifiers: ['BZD', 'BZ$'],
      domains: ['.bz'],
    },
    CDF: {
      name: 'Congolese Franc',
      symbol: 'CDF',
      identifiers: ['CDF', 'FC'],
      domains: ['.cd'],
    },
    CHF: {
      name: 'Swiss Franc',
      symbol: 'CHF',
      identifiers: ['CHF', 'SFr'],
      domains: ['.ch'],
    },
    CLP: {
      name: 'Chilean Peso',
      symbol: 'CLP$',
      identifiers: ['CLP', 'CLP$'],
      domains: ['.cl'],
    },
    CNY: {
      name: 'Chinese Yuan Renminbi',
      symbol: '¥',
      identifiers: ['CNY', '¥', 'RMB', '元'],
      domains: ['.cn'],
    },
    COP: {
      name: 'Colombian Peso',
      symbol: 'COL$',
      identifiers: ['COP', 'COL$'],
      domains: ['.co'],
    },
    CRC: {
      name: 'Costa Rican Colon',
      symbol: '₡',
      identifiers: ['CRC', '₡'],
      domains: ['.cr'],
    },
    CUP: {
      name: 'Cuban Peso',
      symbol: '$MN',
      identifiers: ['CUP', '$MN'],
      domains: ['.cu'],
    },
    CVE: {
      name: 'Cabo Verde Escudo',
      symbol: 'CVE',
      identifiers: ['CVE', 'Esc'],
      domains: ['.cv'],
    },
    DJF: {
      name: 'Djiboutian Franc',
      symbol: 'Fdj',
      identifiers: ['DJF', 'Fdj'],
      domains: ['.dj'],
    },
    DKK: {
      name: 'Danish Krone',
      symbol: 'kr',
      identifiers: ['DKK', 'kr'],
      domains: ['.dk'],
    },
    DOP: {
      name: 'Dominican Peso',
      symbol: 'RD$',
      identifiers: ['DOP', 'RD$'],
      domains: ['.do'],
    },
    DZD: {
      name: 'Algerian Dinar',
      symbol: 'DA',
      identifiers: ['DZD', 'DA', 'د.ج'],
      domains: ['.dz'],
    },
    EGP: {
      name: 'Egyptian Pound',
      symbol: 'E£',
      identifiers: ['EGP', 'E£', 'LE', 'ج.م'],
      domains: ['.eg'],
    },
    ERN: {
      name: 'Eritrean Nakfa',
      symbol: 'ERN',
      identifiers: ['ERN', 'Nfk'],
      domains: ['.er'],
    },
    ETB: {
      name: 'Ethiopian Birr',
      symbol: 'Br',
      identifiers: ['ETB', 'Birr'],
      domains: ['.et'],
    },
    FJD: {
      name: 'Fiji Dollar',
      symbol: 'FJ$',
      identifiers: ['FJD', 'FJ$'],
      domains: ['.fj'],
    },
    FKP: {
      name: 'Falkland Islands Pound',
      symbol: 'FK£',
      identifiers: ['FKP', 'FK£'],
      domains: ['.fk'],
    },
    GEL: {
      name: 'Georgian Lari',
      symbol: '₾',
      identifiers: ['GEL', '₾'],
      domains: ['.ge'],
    },
    GHS: {
      name: 'Ghanaian Cedi',
      symbol: '₵',
      identifiers: ['GHS', '₵', 'GH₵'],
      domains: ['.gh'],
    },
    GIP: {
      name: 'Gibraltar Pound',
      symbol: 'GIP£',
      identifiers: ['GIP', 'GIP£'],
      domains: ['.gi'],
    },
    GMD: {
      name: 'Gambian Dalasi',
      symbol: 'GMD',
      identifiers: ['GMD', 'D'],
      domains: ['.gm'],
    },
    GNF: {
      name: 'Guinean Franc',
      symbol: 'GNF',
      identifiers: ['GNF', 'FG'],
      domains: ['.gn'],
    },
    GTQ: {
      name: 'Guatemalan Quetzal',
      symbol: 'Q',
      identifiers: ['GTQ', 'Q'],
      domains: ['.gt'],
    },
    GYD: {
      name: 'Guyanese Dollar',
      symbol: 'G$',
      identifiers: ['GYD', 'G$'],
      domains: ['.gy'],
    },
    HKD: {
      name: 'Hong Kong Dollar',
      symbol: 'HK$',
      identifiers: ['HKD', 'HK$'],
      domains: ['.hk'],
    },
    HNL: {
      name: 'Honduran Lempira',
      symbol: 'L',
      identifiers: ['HNL', 'L'],
      domains: ['.hn'],
    },
    HTG: {
      name: 'Haitian Gourde',
      symbol: 'G',
      identifiers: ['HTG', 'G'],
      domains: ['.ht'],
    },
    HUF: {
      name: 'Hungarian Forint',
      symbol: 'Ft',
      identifiers: ['HUF', 'Ft'],
      domains: ['.hu'],
    },
    IDR: {
      name: 'Indonesian Rupiah',
      symbol: 'Rp',
      identifiers: ['IDR', 'Rp'],
      domains: ['.id'],
    },
    ILS: {
      name: 'Israeli New Shekel',
      symbol: '₪',
      identifiers: ['ILS', '₪', 'NIS', 'ש"ח'],
      domains: ['.il'],
    },
    INR: {
      name: 'Indian Rupee',
      symbol: '₹',
      identifiers: ['INR', '₹', 'Rs'],
      domains: ['.in'],
    },
    IQD: {
      name: 'Iraqi Dinar',
      symbol: 'IQD',
      identifiers: ['IQD', 'د.ع'],
      domains: ['.iq'],
    },
    IRR: {
      name: 'Iranian Rial',
      symbol: '﷼',
      identifiers: ['IRR', '﷼'],
      domains: ['.ir'],
    },
    ISK: {
      name: 'Icelandic Krona',
      symbol: 'kr',
      identifiers: ['ISK', 'Íkr'],
      domains: ['.is'],
    },
    JMD: {
      name: 'Jamaican Dollar',
      symbol: 'J$',
      identifiers: ['JMD', 'J$'],
      domains: ['.jm'],
    },
    JOD: {
      name: 'Jordanian Dinar',
      symbol: 'JD',
      identifiers: ['JOD', 'JD', 'د.أ'],
      domains: ['.jo'],
    },
    JPY: {
      name: 'Japanese Yen',
      symbol: '¥',
      identifiers: ['JPY', '¥', '円'],
      domains: ['.jp'],
    },
    KES: {
      name: 'Kenyan Shilling',
      symbol: 'KSh',
      identifiers: ['KES', 'KSh'],
      domains: ['.ke'],
    },
    KGS: {
      name: 'Kyrgyzstani Som',
      symbol: 'сом',
      identifiers: ['KGS', 'сом'],
      domains: ['.kg'],
    },
    KHR: {
      name: 'Cambodian Riel',
      symbol: '៛',
      identifiers: ['KHR', '៛'],
      domains: ['.kh'],
    },
    KMF: {
      name: 'Comorian Franc',
      symbol: 'CF',
      identifiers: ['KMF', 'CF'],
      domains: ['.km'],
    },
    KPW: {
      name: 'North Korean Won',
      symbol: '₩',
      identifiers: ['KPW', '₩'],
      domains: ['.kp'],
    },
    KRW: {
      name: 'South Korean Won',
      symbol: '₩',
      identifiers: ['KRW', '₩', '원'],
      domains: ['.kr'],
    },
    KWD: {
      name: 'Kuwaiti Dinar',
      symbol: 'KD',
      identifiers: ['KWD', 'KD', 'د.ك'],
      domains: ['.kw'],
    },
    KYD: {
      name: 'Cayman Islands Dollar',
      symbol: 'CI$',
      identifiers: ['KYD', 'CI$'],
      domains: ['.ky'],
    },
    KZT: {
      name: 'Kazakhstani Tenge',
      symbol: '₸',
      identifiers: ['KZT', '₸'],
      domains: ['.kz'],
    },
    LAK: {
      name: 'Lao Kip',
      symbol: '₭',
      identifiers: ['LAK', '₭'],
      domains: ['.la'],
    },
    LBP: {
      name: 'Lebanese Pound',
      symbol: 'LL',
      identifiers: ['LBP', 'LL', 'ل.ل'],
      domains: ['.lb'],
    },
    LKR: {
      name: 'Sri Lankan Rupee',
      symbol: 'Rs',
      identifiers: ['LKR', 'SL Rs'],
      domains: ['.lk'],
    },
    LRD: {
      name: 'Liberian Dollar',
      symbol: 'L$',
      identifiers: ['LRD', 'L$'],
      domains: ['.lr'],
    },
    LSL: {
      name: 'Lesotho Loti',
      symbol: 'M',
      identifiers: ['LSL', 'M'],
      domains: ['.ls'],
    },
    LYD: {
      name: 'Libyan Dinar',
      symbol: 'LD',
      identifiers: ['LYD', 'LD', 'ل.د'],
      domains: ['.ly'],
    },
    MAD: {
      name: 'Moroccan Dirham',
      symbol: 'MAD',
      identifiers: ['MAD', 'DH', 'د.م.'],
      domains: ['.ma'],
    },
    MDL: {
      name: 'Moldovan Leu',
      symbol: 'MDL',
      identifiers: ['MDL', 'lei'],
      domains: ['.md'],
    },
    MGA: {
      name: 'Malagasy Ariary',
      symbol: 'Ar',
      identifiers: ['MGA', 'Ar'],
      domains: ['.mg'],
    },
    MKD: {
      name: 'Macedonian Denar',
      symbol: 'MKD',
      identifiers: ['MKD', 'ден'],
      domains: ['.mk'],
    },
    MMK: {
      name: 'Myanmar Kyat',
      symbol: 'K',
      identifiers: ['MMK', 'K'],
      domains: ['.mm'],
    },
    MNT: {
      name: 'Mongolian Tugrik',
      symbol: '₮',
      identifiers: ['MNT', '₮'],
      domains: ['.mn'],
    },
    MOP: {
      name: 'Macanese Pataca',
      symbol: 'MOP$',
      identifiers: ['MOP', 'MOP$'],
      domains: ['.mo'],
    },
    MRU: {
      name: 'Mauritanian Ouguiya',
      symbol: 'UM',
      identifiers: ['MRU', 'UM'],
      domains: ['.mr'],
    },
    MUR: {
      name: 'Mauritian Rupee',
      symbol: 'Rs',
      identifiers: ['MUR', 'MRs'],
      domains: ['.mu'],
    },
    MVR: {
      name: 'Maldivian Rufiyaa',
      symbol: 'Rf',
      identifiers: ['MVR', 'Rf'],
      domains: ['.mv'],
    },
    MWK: {
      name: 'Malawian Kwacha',
      symbol: 'MK',
      identifiers: ['MWK', 'MK'],
      domains: ['.mw'],
    },
    MXN: {
      name: 'Mexican Peso',
      symbol: 'Mex$',
      identifiers: ['MXN', 'Mex$'],
      domains: ['.mx'],
    },
    MYR: {
      name: 'Malaysian Ringgit',
      symbol: 'RM',
      identifiers: ['MYR', 'RM'],
      domains: ['.my'],
    },
    MZN: {
      name: 'Mozambican Metical',
      symbol: 'MTn',
      identifiers: ['MZN', 'MTn'],
      domains: ['.mz'],
    },
    NAD: {
      name: 'Namibian Dollar',
      symbol: 'N$',
      identifiers: ['NAD', 'N$'],
      domains: ['.na'],
    },
    NGN: {
      name: 'Nigerian Naira',
      symbol: '₦',
      identifiers: ['NGN', '₦'],
      domains: ['.ng'],
    },
    NIO: {
      name: 'Nicaraguan Cordoba',
      symbol: 'C$',
      identifiers: ['NIO', 'C$'],
      domains: ['.ni'],
    },
    NOK: {
      name: 'Norwegian Krone',
      symbol: 'kr',
      identifiers: ['NOK', 'kr'],
      domains: ['.no'],
    },
    NPR: {
      name: 'Nepalese Rupee',
      symbol: 'Rs',
      identifiers: ['NPR', 'NRs'],
      domains: ['.np'],
    },
    NZD: {
      name: 'New Zealand Dollar',
      symbol: 'NZ$',
      identifiers: ['NZD', 'NZ$'],
      domains: [],
    },
    OMR: {
      name: 'Omani Rial',
      symbol: 'OMR',
      identifiers: ['OMR', 'ر.ع.'],
      domains: ['.om'],
    },
    PAB: {
      name: 'Panamanian Balboa',
      symbol: 'B/.',
      identifiers: ['PAB', 'B/.'],
      domains: ['.pa'],
    },
    PEN: {
      name: 'Peruvian Sol',
      symbol: 'S/',
      identifiers: ['PEN', 'S/'],
      domains: ['.pe'],
    },
    PGK: {
      name: 'Papua New Guinean Kina',
      symbol: 'K',
      identifiers: ['PGK', 'K'],
      domains: ['.pg'],
    },
    PHP: {
      name: 'Philippine Peso',
      symbol: '₱',
      identifiers: ['PHP', '₱', 'PhP'],
      domains: ['.ph'],
    },
    PKR: {
      name: 'Pakistani Rupee',
      symbol: 'Rs',
      identifiers: ['PKR', 'PRs'],
      domains: ['.pk'],
    },
    PYG: {
      name: 'Paraguayan Guarani',
      symbol: '₲',
      identifiers: ['PYG', '₲', 'Gs'],
      domains: ['.py'],
    },
    QAR: {
      name: 'Qatari Rial',
      symbol: 'QR',
      identifiers: ['QAR', 'QR', 'ر.ق'],
      domains: ['.qa'],
    },
    RON: {
      name: 'Romanian Leu',
      symbol: 'lei',
      identifiers: ['RON', 'lei'],
      domains: ['.ro'],
    },
    RSD: {
      name: 'Serbian Dinar',
      symbol: 'RSD',
      identifiers: ['RSD', 'дин'],
      domains: ['.rs'],
    },
    RWF: {
      name: 'Rwandan Franc',
      symbol: 'FRw',
      identifiers: ['RWF', 'FRw'],
      domains: ['.rw'],
    },
    SAR: {
      name: 'Saudi Riyal',
      symbol: 'SR',
      identifiers: ['SAR', 'SR', 'ر.س'],
      domains: ['.sa'],
    },
    SBD: {
      name: 'Solomon Islands Dollar',
      symbol: 'SI$',
      identifiers: ['SBD', 'SI$'],
      domains: ['.sb'],
    },
    SCR: {
      name: 'Seychellois Rupee',
      symbol: 'SCR',
      identifiers: ['SCR', 'SR'],
      domains: ['.sc'],
    },
    SDG: {
      name: 'Sudanese Pound',
      symbol: 'SDG',
      identifiers: ['SDG', 'ج.س.'],
      domains: ['.sd'],
    },
    SEK: {
      name: 'Swedish Krona',
      symbol: 'kr',
      identifiers: ['SEK', 'kr'],
      domains: ['.se'],
    },
    SGD: {
      name: 'Singapore Dollar',
      symbol: 'S$',
      identifiers: ['SGD', 'S$'],
      domains: ['.sg'],
    },
    SHP: {
      name: 'Saint Helena Pound',
      symbol: 'SHP£',
      identifiers: ['SHP', 'SHP£'],
      domains: ['.sh'],
    },
    SLE: {
      name: 'Sierra Leonean Leone',
      symbol: 'Le',
      identifiers: ['SLE', 'Le'],
      domains: ['.sl'],
    },
    SOS: {
      name: 'Somali Shilling',
      symbol: 'SOS',
      identifiers: ['SOS', 'Sh.So.'],
      domains: ['.so'],
    },
    SRD: {
      name: 'Surinamese Dollar',
      symbol: 'SRD',
      identifiers: ['SRD'],
      domains: ['.sr'],
    },
    SSP: {
      name: 'South Sudanese Pound',
      symbol: 'SSP',
      identifiers: ['SSP'],
      domains: ['.ss'],
    },
    STN: {
      name: 'Sao Tome and Principe Dobra',
      symbol: 'Db',
      identifiers: ['STN', 'Db'],
      domains: ['.st'],
    },
    SVC: {
      name: 'Salvadoran Colon',
      symbol: 'SVC',
      identifiers: ['SVC'],
      domains: ['.sv'],
    },
    SZL: {
      name: 'Eswatini Lilangeni',
      symbol: 'SZL',
      identifiers: ['SZL', 'L'],
      domains: ['.sz'],
    },
    THB: {
      name: 'Thai Baht',
      symbol: '฿',
      identifiers: ['THB', '฿'],
      domains: ['.th'],
    },
    TJS: {
      name: 'Tajikistani Somoni',
      symbol: 'TJS',
      identifiers: ['TJS', 'Somoni'],
      domains: ['.tj'],
    },
    TMT: {
      name: 'Turkmenistani Manat',
      symbol: 'TMT',
      identifiers: ['TMT', 'm'],
      domains: ['.tm'],
    },
    TND: {
      name: 'Tunisian Dinar',
      symbol: 'DT',
      identifiers: ['TND', 'DT', 'د.ت'],
      domains: ['.tn'],
    },
    TOP: {
      name: 'Tongan Paanga',
      symbol: 'T$',
      identifiers: ['TOP', 'T$'],
      domains: ['.to'],
    },
    TTD: {
      name: 'Trinidad and Tobago Dollar',
      symbol: 'TT$',
      identifiers: ['TTD', 'TT$'],
      domains: ['.tt'],
    },
    TWD: {
      name: 'New Taiwan Dollar',
      symbol: 'NT$',
      identifiers: ['TWD', 'NT$'],
      domains: ['.tw'],
    },
    TZS: {
      name: 'Tanzanian Shilling',
      symbol: 'TSh',
      identifiers: ['TZS', 'TSh'],
      domains: ['.tz'],
    },
    UGX: {
      name: 'Ugandan Shilling',
      symbol: 'USh',
      identifiers: ['UGX', 'USh'],
      domains: ['.ug'],
    },
    UYU: {
      name: 'Uruguayan Peso',
      symbol: 'UYU$',
      identifiers: ['UYU', 'UYU$'],
      domains: ['.uy'],
    },
    UZS: {
      name: 'Uzbekistani Sum',
      symbol: 'UZS',
      identifiers: ['UZS', 'сўм'],
      domains: ['.uz'],
    },
    VES: {
      name: 'Venezuelan Bolivar Digital',
      symbol: 'Bs.D',
      identifiers: ['VES', 'Bs.D'],
      domains: ['.ve'],
    },
    VND: {
      name: 'Vietnamese Dong',
      symbol: '₫',
      identifiers: ['VND', '₫', 'đ'],
      domains: ['.vn'],
    },
    VUV: {
      name: 'Vanuatu Vatu',
      symbol: 'VT',
      identifiers: ['VUV', 'VT'],
      domains: ['.vu'],
    },
    WST: {
      name: 'Samoan Tala',
      symbol: 'WS$',
      identifiers: ['WST', 'WS$'],
      domains: ['.ws'],
    },
    XAF: {
      name: 'Central African CFA Franc',
      symbol: 'FCFA',
      identifiers: ['XAF', 'FCFA'],
      domains: [],
    },
    XCD: {
      name: 'East Caribbean Dollar',
      symbol: 'EC$',
      identifiers: ['XCD', 'EC$'],
      domains: [],
    },
    XOF: {
      name: 'West African CFA Franc',
      identifiers: ['XOF', 'CFA'],
      symbol: 'CFA',
      domains: [],
    },
    XPF: {
      name: 'CFP Franc',
      symbol: 'FCFP',
      identifiers: ['XPF', 'FCFP'],
      domains: [],
    },
    YER: {
      name: 'Yemeni Rial',
      symbol: 'YER',
      identifiers: ['YER', 'ر.ي'],
      domains: ['.ye'],
    },
    ZAR: {
      name: 'South African Rand',
      symbol: 'R',
      identifiers: ['ZAR', 'R'],
      domains: ['.za'],
    },
    ZMW: {
      name: 'Zambian Kwacha',
      symbol: 'ZK',
      identifiers: ['ZMW', 'ZK'],
      domains: ['.zm'],
    },
    ZWG: {
      name: 'Zimbabwe Gold',
      symbol: 'ZWG',
      identifiers: ['ZWG'],
      domains: ['.zw'],
    },
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    currencies: JSON.parse(JSON.stringify(DEFAULT_CURRENCIES)),
    conversionPairs: [
      { from: 'BYN', to: 'USD' },
      { from: 'BYN', to: 'EUR' },
      { from: 'RUB', to: 'USD' },
      { from: 'RUB', to: 'EUR' },
    ],
    rateSources: ['nbrb'],
    rateSourceOverrides: {},
    customRates: {},
    domainCurrencyMap: {},
    siteMode: 'all',
    whitelist: [],
    theme: null, // null = auto-detect, 'light' | 'dark' = manual
    timeFormat: null, // null = auto-detect, '12h' | '24h' = manual override
    numberFormat: null, // null = auto-detect, 'en-US' | 'de-DE' = manual override
    _settingsVersion: 7,
  };

  const RATE_SOURCES = {
    nbrb: {
      name: 'National Bank of Belarus',
      convention: 'direct',
      fetchBaseRates: async () => {
        const resp = await fetch('https://api.nbrb.by/exrates/rates?periodicity=0');
        if (!resp.ok) throw new Error(`NBRB API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { BYN: 1 };
        for (const item of data) {
          rates[item.Cur_Abbreviation] = item.Cur_OfficialRate / item.Cur_Scale;
        }
        return { base: 'BYN', rates };
      },
    },
    ecb: {
      name: 'European Central Bank',
      convention: 'indirect',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
        if (!resp.ok) throw new Error(`ECB API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { EUR: 1 };
        const re = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          rates[match[1]] = parseFloat(match[2]);
        }
        return { base: 'EUR', rates };
      },
    },
    nbp: {
      name: 'National Bank of Poland',
      convention: 'direct',
      fetchBaseRates: async () => {
        const resp = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/');
        if (!resp.ok) throw new Error(`NBP API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { PLN: 1 };
        if (Array.isArray(data) && data[0] && data[0].rates) {
          for (const item of data[0].rates) {
            rates[item.code] = item.mid;
          }
        }
        return { base: 'PLN', rates };
      },
    },
    nbu: {
      name: 'National Bank of Ukraine',
      convention: 'direct',
      fetchBaseRates: async () => {
        const today = new Date();
        const dateStr = `${String(today.getFullYear())}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const resp = await fetch(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json&date=${dateStr}`);
        if (!resp.ok) throw new Error(`NBU API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { UAH: 1 };
        for (const item of data) {
          rates[item.cc] = item.rate;
        }
        return { base: 'UAH', rates };
      },
    },
    cbr: {
      name: 'Bank of Russia',
      convention: 'direct',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.cbr.ru/scripts/XML_daily_eng.asp');
        if (!resp.ok) throw new Error(`CBR API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { RUB: 1 };
        const re = /<CharCode>([A-Z]{3})<\/CharCode>\s*<Nominal>(\d+)<\/Nominal>\s*<Name>[^<]*<\/Name>\s*<Value>([\d.,]+)<\/Value>/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, nominal, value] = match;
          rates[code] = parseFloat(value.replace(',', '.')) / parseInt(nominal, 10);
        }
        return { base: 'RUB', rates };
      },
    },
    cnb: {
      name: 'Czech National Bank',
      convention: 'direct',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.xml');
        if (!resp.ok) throw new Error(`CNB API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { CZK: 1 };
        const re = /<radek\s[^>]*kod="([A-Z]{3})"[^>]*mnozstvi="(\d+)"[^>]*kurz="([\d.,]+)"/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, amount, rate] = match;
          rates[code] = parseFloat(rate.replace(',', '.')) / parseInt(amount, 10);
        }
        return { base: 'CZK', rates };
      },
    },
    tcmb: {
      name: 'Central Bank of Turkey',
      convention: 'direct',
      fetchBaseRates: async () => {
        const resp = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml');
        if (!resp.ok) throw new Error(`TCMB API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { TRY: 1 };
        const re = /<Currency\s[^>]*CurrencyCode="([A-Z]{3})"[^>]*>[\s\S]*?<Unit>(\d+)<\/Unit>[\s\S]*?<ForexBuying>([\d.,]+)<\/ForexBuying>/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, unit, buying] = match;
          rates[code] = parseFloat(buying.replace(',', '.')) / parseInt(unit, 10);
        }
        return { base: 'TRY', rates };
      },
    },
    boc: {
      name: 'Bank of Canada',
      convention: 'direct',
      fetchBaseRates: async () => {
        const d = new Date();
        d.setDate(d.getDate() - 5);
        const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const series = 'FXUSDCAD,FXEURCAD,FXJPYCAD,FXCHFCAD,FXGBPCAD,FXAUDCAD,FXBRLCAD,FXCNYCAD,FXHKDCAD,FXINRCAD,FXIDRCAD,FXMXNCAD,FXNZDCAD,FXNOKCAD,FXPENCAD,FXRUBCAD,FXSARCAD,FXSGDCAD,FXZARCAD,FXKRWCAD,FXSEKCAD,FXTWDCAD,FXTRYCAD';
        const resp = await fetch(`https://www.bankofcanada.ca/valet/observations/${series}/json?start_date=${startDate}`);
        if (!resp.ok) throw new Error(`BOC API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { CAD: 1 };
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
            rates[match[1]] = parseFloat(val.v);
          }
        }
        return { base: 'CAD', rates };
      },
    },
    bcb: {
      name: 'Central Bank of Brazil',
      convention: 'direct',
      fetchBaseRates: async () => {
        const rates = { BRL: 1 };
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
            rates.USD = cotacao.cotacaoCompra;
            return { base: 'BRL', rates, rateDate: cotacao.dataHoraCotacao };
          }
        }
        throw new Error('BCB: no rates available for the last 5 days');
      },
    },
    boe: {
      name: 'Bank of England',
      convention: 'direct',
      fetchBaseRates: async () => {
        // BOE retired their IADB API. Using Frankfurter (ECB reference rates) for GBP rates.
        const resp = await fetch('https://api.frankfurter.app/latest?from=GBP');
        if (!resp.ok) throw new Error(`BOE API error: ${resp.status}`);
        const data = await resp.json();
        if (!data || typeof data.rates !== 'object') throw new Error('BOE API: invalid response');
        const rates = { GBP: 1, ...data.rates };
        return { base: 'GBP', rates };
      },
    },
    hkma: {
      name: 'Hong Kong Monetary Authority',
      convention: 'direct',
      fetchBaseRates: async () => {
        const resp = await fetch('https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?offset=0&pagesize=1');
        if (!resp.ok) throw new Error(`HKMA API error: ${resp.status}`);
        const data = await resp.json();
        const records = data && data.result && data.result.records;
        if (!records || records.length === 0) throw new Error('HKMA API: no records returned');
        const latest = records[0];
        const rates = { HKD: 1 };
        const fieldMap = {
          usd: 'USD', gbp: 'GBP', jpy: 'JPY', cad: 'CAD', aud: 'AUD',
          sgd: 'SGD', twd: 'TWD', chf: 'CHF', cny: 'CNY', krw: 'KRW',
          thb: 'THB', myr: 'MYR', eur: 'EUR', php: 'PHP', inr: 'INR',
          idr: 'IDR', zar: 'ZAR',
        };
        for (const [field, code] of Object.entries(fieldMap)) {
          const val = latest[field];
          if (val != null) rates[code] = parseFloat(val);
        }
        return { base: 'HKD', rates };
      },
    },
    nbk: {
      name: 'National Bank of Kazakhstan',
      convention: 'direct',
      fetchBaseRates: async () => {
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
        const resp = await fetch(`https://nationalbank.kz/rss/get_rates.cfm?fdate=${dateStr}`);
        if (!resp.ok) throw new Error(`NBK API error: ${resp.status}`);
        const text = await resp.text();
        const rates = { KZT: 1 };
        const re = /<item>\s*<fullname>[^<]*<\/fullname>\s*<title>([A-Z]{3})<\/title>\s*<description>([\d.]+)<\/description>\s*<quant>(\d+)<\/quant>/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          const [, code, rate, quant] = match;
          rates[code] = parseFloat(rate) / parseInt(quant, 10);
        }
        return { base: 'KZT', rates };
      },
    },
  };

  const CACHE_KEY = 'dollarbill_rates';
  const SETTINGS_KEY = 'dollarbill_settings';
  const FETCH_STATUS_KEY = 'dollarbill_fetch_status';
  const LOADED_RATES_KEY = 'dollarbill_loaded_rates';

  const META_KEYS = new Set(['timestamp', '_conflicts', '_usedSources', '_sourceErrors']);

  // ---- Derived helpers ----

  function getSourceCurrencies(settings) {
    return [...new Set((settings.conversionPairs || []).map(p => p.from))];
  }

  function getTargetCurrencies(settings) {
    return [...new Set((settings.conversionPairs || []).map(p => p.to))];
  }

  function getTargetCurrenciesForSource(settings, sourceCode) {
    return [...new Set(
      (settings.conversionPairs || [])
        .filter(p => p.from === sourceCode)
        .map(p => p.to)
    )];
  }

  function buildConversionMap(settings) {
    const map = {};
    for (const pair of settings.conversionPairs || []) {
      if (!map[pair.from]) map[pair.from] = [];
      if (!map[pair.from].includes(pair.to)) {
        map[pair.from].push(pair.to);
      }
    }
    return map;
  }

  // ---- Identifier pattern compilation ----

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function identifierToRegexBody(id) {
    const parts = id.trim().split(/\s+/);
    return parts.map(p => {
      let escaped = escapeRegex(p);
      escaped = escaped.replace(/\\\./g, '\\.?'); // optional dots
      return escaped;
    }).join('\\s+');
  }

  // Single-char currency symbols excluded by lookbehind to prevent double-matching
  const CURRENCY_SYMBOLS = '$€₽¥₩£₱฿₫₹₴₺₼₸₭₮₾₵₡₲₦₪؋៛ƒ';

  function buildPatternsFromIdentifiers(identifiers) {
    const patterns = [];
    for (const id of identifiers) {
      if (!id.trim()) continue;
      const regexBody = identifierToRegexBody(id);
      // Prevent matching inside words across all scripts (e.g. "раз" should not match "р")
      const notAfterLetterOrCur = `(?<![\\p{L}${CURRENCY_SYMBOLS}])`;
      const notBeforeLetter = `(?![\\p{L}])`;
      const amount = `(?<![.,\\d])(\\d[\\d\\s]*(?:[.,]\\d{1,4})?)`;
      const body = `(?:${regexBody})`;
      patterns.push(`${amount}\\s*${notAfterLetterOrCur}${body}${notBeforeLetter}`);
      patterns.push(`${notAfterLetterOrCur}${body}\\s*${amount}${notBeforeLetter}`);
    }
    return patterns;
  }

  function buildIdentifierOwnerMap(currencies) {
    const map = {}; // norm -> [{ code, originalId }]
    for (const [code, cur] of Object.entries(currencies || {})) {
      for (const id of (cur.identifiers || [])) {
        const norm = id.trim().toLowerCase();
        if (!map[norm]) map[norm] = [];
        if (!map[norm].some(e => e.code === code)) {
          map[norm].push({ code, originalId: id });
        }
      }
    }
    return map;
  }

  function detectIdentifierConflicts(currencies) {
    const ownerMap = buildIdentifierOwnerMap(currencies);
    const conflicts = [];
    for (const [id, entries] of Object.entries(ownerMap)) {
      if (entries.length > 1) {
        conflicts.push({ identifier: id, currencies: entries.map(e => e.code) });
      }
    }
    return conflicts;
  }

  // ---- Rate table construction ----

  function buildRateTable(baseRates, sources, targets) {
    const { base, rates } = baseRates;
    const result = {};
    const all = [...new Set([...sources, ...targets])];
    if (!all.includes(base)) all.push(base);

    for (const c of all) {
      result[c] = {};
    }

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const from = all[i];
        const to = all[j];
        const fromInBase = rates[from];
        const toInBase = rates[to];
        if (fromInBase == null || toInBase == null) continue;

        let crossRate;
        if (baseRates.convention === 'indirect') {
          crossRate = toInBase / fromInBase;
        } else {
          crossRate = fromInBase / toInBase;
        }

        if (crossRate >= 1) {
          result[from][to] = crossRate;
        } else {
          result[to][from] = 1 / crossRate;
        }
      }
    }
    return result;
  }

  // ---- Multi-source merge ----

  function buildMergedRateTable(sourceRatesMap, orderedSourceIds, sourceCurrencies, targetCurrencies) {
    const all = [...new Set([...sourceCurrencies, ...targetCurrencies])];

    // Build individual rate tables per source
    const rateTables = {};
    for (const sourceId of Object.keys(sourceRatesMap)) {
      const baseRates = sourceRatesMap[sourceId];
      if (!all.includes(baseRates.base)) all.push(baseRates.base);
      rateTables[sourceId] = buildRateTable(baseRates, sourceCurrencies, targetCurrencies);
    }

    const merged = {};
    for (const c of all) merged[c] = {};

    // Collect all pair rates across sources
    const pairSources = {}; // "FROM:TO" -> { sourceId: rate }
    for (const [sourceId, table] of Object.entries(rateTables)) {
      for (const [from, toMap] of Object.entries(table)) {
        for (const [to, rate] of Object.entries(toMap)) {
          const key = `${from}:${to}`;
          if (!pairSources[key]) pairSources[key] = {};
          pairSources[key][sourceId] = rate;
        }
      }
    }

    // Merge and detect conflicts
    const conflicts = {};
    const activeSourceIds = orderedSourceIds.filter(id => rateTables[id]);

    for (const [pairKey, sourcesMap] of Object.entries(pairSources)) {
      const [from, to] = pairKey.split(':');
      const providingSources = Object.keys(sourcesMap);

      if (providingSources.length === 1) {
        // Only one source provides this rate
        merged[from][to] = sourcesMap[providingSources[0]];
      } else {
        // Multiple sources — check if they agree
        const rates = Object.values(sourcesMap);
        const allSame = rates.every(r => Math.abs(r - rates[0]) < 1e-10);

        if (allSame) {
          merged[from][to] = rates[0];
        } else {
          // Conflict — use first selected source as default
          const defaultSource = activeSourceIds.find(id => sourcesMap[id] !== undefined) || providingSources[0];
          merged[from][to] = sourcesMap[defaultSource];
          conflicts[pairKey] = { ...sourcesMap };
        }
      }
    }

    return { rates: merged, conflicts };
  }

  function getCustomRates(settings) {
    const c = settings.customRates || {};
    const result = {};
    const sources = getSourceCurrencies(settings);
    const targets = getTargetCurrencies(settings);
    const all = [...new Set([...sources, ...targets])];

    for (const from of all) {
      result[from] = {};
    }
    for (const [key, val] of Object.entries(c)) {
      if (val == null) continue;
      const parts = key.split(':');
      if (parts.length !== 2) continue;
      let [from, to] = parts;
      let rate = val;
      if (rate > 0 && rate < 1) {
        [from, to] = [to, from];
        rate = 1 / rate;
      }
      if (!result[from]) result[from] = {};
      result[from][to] = rate;
    }
    return result;
  }

  function deepCloneRateTable(table) {
    const clone = {};
    for (const [from, toMap] of Object.entries(table)) {
      if (META_KEYS.has(from)) continue;
      clone[from] = { ...toMap };
    }
    return clone;
  }

  function getEffectiveRates(settings, cachedApiRates) {
    const base = (cachedApiRates && isCacheValid(cachedApiRates))
      ? deepCloneRateTable(cachedApiRates)
      : {};

    // Apply rate source overrides for conflicting pairs
    if (cachedApiRates && cachedApiRates._conflicts) {
      const overrides = settings.rateSourceOverrides || {};
      for (const [pairKey, sourceRates] of Object.entries(cachedApiRates._conflicts)) {
        const overrideSource = overrides[pairKey];
        if (overrideSource && sourceRates[overrideSource] !== undefined) {
          const [from, to] = pairKey.split(':');
          if (!base[from]) base[from] = {};
          base[from][to] = sourceRates[overrideSource];
        }
      }
    }

    const customNormalized = getCustomRates(settings);
    for (const [from, toMap] of Object.entries(customNormalized)) {
      if (!base[from]) base[from] = {};
      for (const [to, rate] of Object.entries(toMap)) {
        base[from][to] = rate;
      }
    }

    return base;
  }

  function getConflicts(cachedRates) {
    return (cachedRates && cachedRates._conflicts) || {};
  }

  function getUsedSources(cachedRates) {
    return (cachedRates && cachedRates._usedSources) || [];
  }

  function isConflictResolved(pairKey, settings, cachedRates) {
    const conflicts = getConflicts(cachedRates);
    if (!conflicts[pairKey]) return true;
    const overrides = settings.rateSourceOverrides || {};
    const reverseKey = pairKey.includes(':') ? pairKey.split(':').reverse().join(':') : null;
    return overrides[pairKey] !== undefined || (reverseKey && overrides[reverseKey] !== undefined);
  }

  function getActiveSourceForPair(pairKey, reverseKey, settings, cachedRates) {
    const overrides = settings.rateSourceOverrides || {};
    return overrides[pairKey] || (reverseKey && overrides[reverseKey]) || getUsedSources(cachedRates)[0] || '';
  }

  function formatRateForDisplay(from, to, rates) {
    const direct = rates[from] && rates[from][to];
    if (direct != null && direct >= 1) {
      return { base: from, quote: to, rate: direct };
    }
    const reverse = rates[to] && rates[to][from];
    if (reverse != null) {
      return { base: to, quote: from, rate: reverse };
    }
    if (direct != null) {
      return { base: to, quote: from, rate: 1 / direct };
    }
    return null;
  }

  // ---- Migration ----

  function migrateSettingsV1toV2(stored) {
    if (stored._settingsVersion >= 2) return stored;
    if (!stored.sourceCurrencies && !stored.targetCurrencies) return stored;

    const pairs = [];
    const sources = stored.sourceCurrencies || [];
    const targets = stored.targetCurrencies || [];
    for (const from of sources) {
      for (const to of targets) {
        if (from !== to) {
          pairs.push({ from, to });
        }
      }
    }

    stored.conversionPairs = pairs;
    if (stored.rateSource === 'custom') {
      stored.rateSource = 'nbrb';
    }
    stored._settingsVersion = 2;
    delete stored.sourceCurrencies;
    delete stored.targetCurrencies;
    return stored;
  }

  function migrateSettingsV2toV3(stored) {
    if (stored._settingsVersion >= 3) return stored;
    stored._settingsVersion = 3;
    return stored;
  }

  function migrateSettingsV3toV4(stored) {
    if (stored._settingsVersion >= 4) return stored;
    if (stored.rateSource && !stored.rateSources) {
      stored.rateSources = Array.isArray(stored.rateSource) ? stored.rateSource : [stored.rateSource];
    }
    delete stored.rateSource;
    if (!stored.rateSources) stored.rateSources = ['nbrb'];
    stored.rateSourceOverrides = stored.rateSourceOverrides || {};
    stored._settingsVersion = 4;
    return stored;
  }

  function migrateSettingsV4toV5(stored) {
    if (stored._settingsVersion >= 5) return stored;
    // Clean break: drop old-format currencies, defaults will be used
    delete stored.currencies;
    delete stored.ambiguousPatterns;
    stored._settingsVersion = 5;
    return stored;
  }

  function migrateSettingsV5toV6(stored) {
    if (stored._settingsVersion >= 6) return stored;
    stored._settingsVersion = 6;
    return stored;
  }

  // ---- Settings persistence ----

  async function getSettings() {
    // Migrate from sync to local if needed
    let localResult = await chrome.storage.local.get(SETTINGS_KEY);
    if (!localResult[SETTINGS_KEY]) {
      const syncResult = await chrome.storage.sync.get(SETTINGS_KEY);
      if (syncResult[SETTINGS_KEY]) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: syncResult[SETTINGS_KEY] });
        await chrome.storage.sync.remove(SETTINGS_KEY);
        localResult = { [SETTINGS_KEY]: syncResult[SETTINGS_KEY] };
      }
    }

    let stored = localResult[SETTINGS_KEY] || {};

    // Migrate v1 → v2
    if (stored._settingsVersion == null || stored._settingsVersion < 2) {
      stored = migrateSettingsV1toV2(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    // Migrate v2 → v3
    if (stored._settingsVersion < 3) {
      stored = migrateSettingsV2toV3(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    // Migrate v3 → v4
    if (stored._settingsVersion < 4) {
      stored = migrateSettingsV3toV4(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    // Migrate v4 → v5
    if (stored._settingsVersion < 5) {
      stored = migrateSettingsV4toV5(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    // Migrate v5 → v6
    if (stored._settingsVersion < 6) {
      stored = migrateSettingsV5toV6(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    const merged = { ...DEFAULT_SETTINGS, ...stored };
    if (stored.currencies) {
      merged.currencies = { ...DEFAULT_SETTINGS.currencies, ...stored.currencies };
    }
    return merged;
  }

  async function saveSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  async function getCachedRates() {
    const result = await chrome.storage.local.get(CACHE_KEY);
    return result[CACHE_KEY] || null;
  }

  async function cacheRates(rates) {
    await chrome.storage.local.set({ [CACHE_KEY]: rates });
  }

  async function getLoadedRates() {
    const result = await chrome.storage.local.get(LOADED_RATES_KEY);
    return result[LOADED_RATES_KEY] || null;
  }

  async function cacheLoadedRates(loadedRates) {
    await chrome.storage.local.set({ [LOADED_RATES_KEY]: loadedRates });
  }

  async function clearCachedRates() {
    await chrome.storage.local.remove([CACHE_KEY, LOADED_RATES_KEY]);
  }

  async function fetchAndCacheRates(sourceIds, settings) {
    if (typeof sourceIds === 'string') sourceIds = [sourceIds];
    if (!sourceIds || sourceIds.length === 0) {
      const emptyRates = { timestamp: Date.now(), _conflicts: {}, _usedSources: [] };
      await chrome.storage.local.set({ [CACHE_KEY]: emptyRates, [LOADED_RATES_KEY]: {} });
      return emptyRates;
    }

    // Fetch from all sources in parallel, tagging errors with source ID
    const results = await Promise.allSettled(
      sourceIds.map(async (id) => {
        try {
          const source = RATE_SOURCES[id];
          if (!source) throw new Error(`Unknown rate source: ${id}`);
          const baseRates = await source.fetchBaseRates();
          baseRates.convention = source.convention;
          return { id, baseRates };
        } catch (err) {
          err.sourceId = id;
          throw err;
        }
      })
    );

    const sourceRatesMap = {};
    const loadedRatesMap = {};
    const sourceErrors = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { id, baseRates } = result.value;
        sourceRatesMap[id] = baseRates;
        loadedRatesMap[id] = {
          source: id,
          base: baseRates.base,
          convention: baseRates.convention,
          rates: { ...baseRates.rates },
          timestamp: Date.now(),
        };
        if (baseRates.rateDate) {
          loadedRatesMap[id].rateDate = baseRates.rateDate;
        }
      } else {
        const id = result.reason?.sourceId || 'unknown';
        sourceErrors[id] = result.reason?.message || String(result.reason);
        loadedRatesMap[id] = {
          source: id,
          error: result.reason?.message || String(result.reason),
          timestamp: Date.now(),
        };
      }
    }

    const sourceCurrencies = getSourceCurrencies(settings);
    const targetCurrencies = getTargetCurrencies(settings);

    const { rates, conflicts } = buildMergedRateTable(
      sourceRatesMap, sourceIds, sourceCurrencies, targetCurrencies
    );
    rates.timestamp = Date.now();
    rates._conflicts = conflicts;
    rates._usedSources = Object.keys(sourceRatesMap);
    rates._sourceErrors = sourceErrors;

    await chrome.storage.local.set({
      [CACHE_KEY]: rates,
      [LOADED_RATES_KEY]: loadedRatesMap,
    });

    return rates;
  }

  function convert(amount, fromCurrency, toCurrency, rates) {
    const direct = rates[fromCurrency] && rates[fromCurrency][toCurrency];
    if (direct != null) return amount * direct;
    const reverse = rates[toCurrency] && rates[toCurrency][fromCurrency];
    if (reverse != null) return amount / reverse;
    return null;
  }

  function isCacheValid(rates, ttlMs = 30 * 60 * 1000) {
    if (!rates || !rates.timestamp) return false;
    return Date.now() - rates.timestamp < ttlMs;
  }

  async function getFetchStatus() {
    const result = await chrome.storage.local.get(FETCH_STATUS_KEY);
    return result[FETCH_STATUS_KEY] || {
      lastFetchTime: null,
      lastSuccessTime: null,
      lastError: null,
      consecutiveFailures: 0,
    };
  }

  async function saveFetchStatus(status) {
    await chrome.storage.local.set({ [FETCH_STATUS_KEY]: status });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- Time formatting ----

  let _detectedHourCycle = null;

  function detectHourCycle() {
    if (!_detectedHourCycle) {
      const resolved = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
        .resolvedOptions().hourCycle;
      _detectedHourCycle = (resolved === 'h23' || resolved === 'h24') ? 'h23' : 'h12';
    }
    return _detectedHourCycle;
  }

  function formatTimestamp(timestamp, timeFormat, fallback) {
    if (!timestamp) return fallback || '';
    const d = new Date(timestamp);
    const hour12 = timeFormat === '24h' ? false
      : timeFormat === '12h' ? true
      : detectHourCycle() === 'h12';
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12,
    });
  }

  function getFetchState(fetchStatus, rates) {
    if (fetchStatus && fetchStatus.lastError) return 'error';
    if (!rates || !rates.timestamp || !isCacheValid(rates)) return 'stale';
    if (!fetchStatus || !fetchStatus.lastFetchTime) return 'stale';
    return 'ok';
  }

  function formatCacheAge(rates) {
    if (!rates || !rates.timestamp) return '';
    const ageMin = Math.round((Date.now() - rates.timestamp) / 60000);
    return ageMin < 1 ? '< 1 min' : ageMin + ' min';
  }

  function formatNumber(value, decimals, numberFormat) {
    if (value == null || isNaN(value)) return '';
    const locale = numberFormat || undefined;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  function getSourceDisplayName(sourceId) {
    const source = RATE_SOURCES[sourceId];
    return source ? source.name : sourceId;
  }

  const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'BYN', 'RUB', 'PLN', 'UAH', 'CZK', 'TRY', 'BRL', 'INR', 'KRW', 'SEK', 'NOK', 'DKK', 'HKD', 'SGD', 'THB', 'MXN', 'ZAR'];

  return {
    DEFAULT_SETTINGS,
    DEFAULT_CURRENCIES,
    POPULAR_CURRENCIES,
    RATE_SOURCES,
    getSourceDisplayName,
    getSettings,
    saveSettings,
    getCachedRates,
    cacheRates,
    getLoadedRates,
    cacheLoadedRates,
    clearCachedRates,
    fetchAndCacheRates,
    getCustomRates,
    getEffectiveRates,
    buildRateTable,
    buildMergedRateTable,
    convert,
    isCacheValid,
    getFetchStatus,
    saveFetchStatus,
    escapeHtml,
    formatTimestamp,
    getFetchState,
    formatCacheAge,
    formatNumber,
    formatRateForDisplay,
    getSourceCurrencies,
    getTargetCurrencies,
    getTargetCurrenciesForSource,
    buildConversionMap,
    getConflicts,
    getUsedSources,
    isConflictResolved,
    getActiveSourceForPair,
    escapeRegex,
    buildPatternsFromIdentifiers,
    buildIdentifierOwnerMap,
    detectIdentifierConflicts,
  };
})();
