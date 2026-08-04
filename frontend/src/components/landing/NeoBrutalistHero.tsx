import { Link } from "react-router";
import "./NeoBrutalistHero.css";

export function NeoBrutalistHero() {
  return (
    <section id="neo-brutalist-hero" aria-labelledby="neo-brutalist-hero-title">
      <div id="neo-brutalist-hero-copy">
        <p className="neo-brutalist-kicker">BOORA ALI / 01</p>
        <h1 id="neo-brutalist-hero-title">VÁ. VIVA. GUARDE.</h1>
        <p className="neo-brutalist-description">
          Transforme cada lugar marcante em uma memória que continua com você.
        </p>
        <Link className="neo-brutalist-cta" to="/register">
          COMEÇAR AGORA
        </Link>
      </div>

      <div id="neo-brutalist-hero-scene">
        <div id="neo-brutalist-scene">
          <img
            src="/landing-assets/hero-diary.png"
            alt="Diário aberto com foto de café e mapa de lugares salvos"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
