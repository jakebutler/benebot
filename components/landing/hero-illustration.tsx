export function HeroIllustration(): React.ReactNode {
  return (
    <svg
      className="hero-illustration"
      viewBox="0 0 640 640"
      role="img"
      aria-labelledby="hero-illustration-title"
    >
      <title id="hero-illustration-title">
        Una mujer latina mayor sostiene con confianza una factura médica de 620 dólares.
      </title>
      <defs>
        <clipPath id="hero-medallion">
          <circle cx="320" cy="308" r="236" />
        </clipPath>
      </defs>

      <g className="hero-rays hero-rays-gold">
        {Array.from({ length: 12 }, (_, index) => (
          <path
            d="M320 308 L302 -170 L338 -170 Z"
            transform={`rotate(${index * 30} 320 308)`}
            key={`gold-${index}`}
          />
        ))}
      </g>
      <g className="hero-rays hero-rays-pink">
        {Array.from({ length: 6 }, (_, index) => (
          <path
            d="M320 308 L308 -180 L332 -180 Z"
            transform={`rotate(${15 + index * 60} 320 308)`}
            key={`pink-${index}`}
          />
        ))}
      </g>

      <circle cx="320" cy="308" r="236" className="hero-sky" />
      <g clipPath="url(#hero-medallion)">
        <circle cx="320" cy="308" r="236" className="hero-sky" />
        <path d="M320 376 C168 400 96 490 70 600 L570 600 C544 490 472 400 320 376Z" className="hero-cape" />
        <path d="M320 376 C244 388 196 436 168 600 L96 600 C122 486 186 404 320 376Z" className="hero-cape-shadow" />
        <path d="M320 380 C250 392 218 446 208 600 L432 600 C422 446 390 392 320 380Z" className="hero-shirt" />
        <path d="M284 384 L320 440 L356 384Z" className="hero-collar" />
        <circle cx="320" cy="506" r="33" className="hero-emblem" />
        <text x="320" y="519" textAnchor="middle" className="hero-emblem-letter">B</text>
        <ellipse cx="320" cy="258" rx="96" ry="116" className="hero-hair" />
        <path d="M294 318h52v52a26 26 0 0 1-52 0Z" className="hero-neck" />
        <ellipse cx="320" cy="256" rx="73" ry="85" className="hero-face" />
        <ellipse cx="250" cy="262" rx="11" ry="17" className="hero-ear" />
        <ellipse cx="390" cy="262" rx="11" ry="17" className="hero-ear" />
        <path d="M247 250C253 178 282 148 320 148S387 178 393 250C383 204 356 188 320 188S257 204 247 250Z" className="hero-hair" />
        <path d="M252 244C259 186 286 154 318 150" className="hero-grey" />
        <path d="M388 244C383 200 368 172 346 157" className="hero-grey hero-grey-fade" />
        <path d="M280 236Q294 227 309 235M331 235Q346 227 360 236" className="hero-brows" />
        <ellipse cx="294" cy="258" rx="8" ry="9.5" className="hero-eye" />
        <ellipse cx="346" cy="258" rx="8" ry="9.5" className="hero-eye" />
        <circle cx="297" cy="255" r="2.8" className="hero-eye-light" />
        <circle cx="349" cy="255" r="2.8" className="hero-eye-light" />
        <g className="hero-glasses">
          <circle cx="294" cy="258" r="25" />
          <circle cx="346" cy="258" r="25" />
          <path d="M319 256q1-5 2 0M269 252l-19-6M371 252l19-6" />
        </g>
        <path d="M296 296Q320 320 344 296" className="hero-smile" />
        <path d="M282 286q-5 6-3 12M358 286q5 6 3 12" className="hero-laugh-lines" />
        <circle cx="248" cy="288" r="10" className="hero-earring" />
        <circle cx="392" cy="288" r="10" className="hero-earring" />
      </g>
      <circle cx="320" cy="308" r="236" className="hero-medallion-outline" />

      <g transform="rotate(-9 508 470)">
        <rect x="440" y="410" width="168" height="120" rx="14" className="hero-bill" />
        <rect x="462" y="434" width="70" height="9" rx="4.5" className="hero-bill-line" />
        <rect x="462" y="452" width="46" height="9" rx="4.5" className="hero-bill-line" />
        <text x="462" y="502" className="hero-bill-total">$620</text>
        <circle cx="580" cy="424" r="24" className="hero-check-disc" />
        <path d="M569 424l8 9 14-16" className="hero-check" />
      </g>

      <path d="M92 176l9 24 24 9-24 9-9 24-9-24-24-9 24-9Z" className="hero-spark hero-spark-flame" />
      <path d="M556 150l7 18 18 7-18 7-7 18-7-18-18-7 18-7Z" className="hero-spark hero-spark-teal" />
      <circle cx="76" cy="430" r="13" className="hero-spark hero-spark-pink" />
    </svg>
  );
}
