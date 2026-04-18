import Image from "next/image";

import heroImage from "../images/Whisk_2620b685e84dfc19a2f4982716b2f676dreq.jpeg";
import galleryOne from "../images/Whisk_2d0bc804c7d5702883f41847f0c5f751eg.png";
import galleryTwo from "../images/Whisk_8199943798532ebbade41a18f03b6eb5eg.png";
import galleryThree from "../images/Whisk_8199943798532ebbade41a18f03b6eb5egq.png";
import galleryFour from "../images/Whisk_969957481a18e29901b4b58abbf802fbdr.jpeg";
import monogram from "../images/A-J_Monogram-01.svg";
import elementBg from "../images/A-J_ELEMENT_BACKGROUND-02.svg";
import ShareInviteButton from "./shared/share-invite-button";

const galleryItems = [
  { src: galleryOne, alt: "Joanna and Innocent pre-wedding portrait one" },
  { src: galleryTwo, alt: "Joanna and Innocent pre-wedding portrait two" },
  { src: galleryThree, alt: "Joanna and Innocent pre-wedding portrait three" },
  { src: galleryFour, alt: "Joanna and Innocent pre-wedding portrait four" }
];

export default function HomePage() {
  return (
    <main className="site">
      <Image
        className="bg-element bg-element-top"
        src={elementBg}
        alt=""
        aria-hidden
      />
      <Image
        className="bg-element bg-element-bottom"
        src={elementBg}
        alt=""
        aria-hidden
      />
      <div className="hero-glow hero-glow-left" aria-hidden />
      <div className="hero-glow hero-glow-right" aria-hidden />

      <header className="hero">
        <Image
          className="monogram-mark"
          src={monogram}
          alt="Joanna and Innocent monogram"
          priority
        />
        <p className="lead">Together with our families, invite you to our wedding</p>
        <h1>
          NYOMEDZI FIATI Joanna
          <span>and</span>
          ADRAH Innocent
        </h1>
        <p className="hero-meta">30 May 2026 | 1:00 PM</p>
        <ShareInviteButton />
        <figure className="hero-image-wrap">
          <Image
            className="hero-image"
            src={heroImage}
            alt="Joanna and Innocent pre-wedding hero portrait"
            priority
          />
        </figure>
      </header>

      <section className="block">
        <h2>Venue</h2>
        <p>Kingdom Hall of Jehovah&apos;s Witnesses</p>
        <p>Anyinam, near the Islamic School Park</p>
        <a
          className="venue-link"
          href="https://www.google.com/maps?q=6.371126651763916,-0.5389748215675354&z=17&hl=en"
          target="_blank"
          rel="noreferrer"
        >
          View venue on Google Maps
        </a>
      </section>

      <section className="block gallery">
        <div className="section-top">
          <h2>Gallery</h2>
          <p>Pre-wedding shoots and memorable moments</p>
        </div>
        <div className="gallery-grid">
          {galleryItems.map((item) => (
            <figure key={item.alt} className="gallery-item">
              <Image src={item.src} alt={item.alt} className="gallery-image" />
            </figure>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>Downloads</h2>
        <p>Program outlines and shared wedding media will be available here.</p>
        <div className="action-links">
          <a className="action-link" href="/downloads/program-outline-main.pdf" target="_blank">
            View Program Outline (PDF)
          </a>
          <a className="action-link" href="/downloads/gallery-downloads-info.txt" target="_blank">
            Gallery Downloads Info
          </a>
          <a className="action-link" href="/admin/login">
            Authorized Upload Portal
          </a>
        </div>
      </section>

      <section className="block">
        <h2>Find My Photos</h2>
        <p>
          After the wedding, guests can upload one selfie and receive only the photos where
          they appear.
        </p>
        <p className="feature-note">
          AI photo matching will be activated after official wedding photos are uploaded.
        </p>
        <div className="action-links">
          <a className="action-link" href="/find-my-photos">
            Start Find My Photos
          </a>
          <a className="action-link" href="/downloads/gallery-downloads-info.txt" target="_blank">
            How Photo Access Works
          </a>
        </div>
      </section>

      <section className="block contacts">
        <h2>RSVP Contacts</h2>
        <div className="contact-grid">
          <article>
            <p className="name">Favour</p>
            <a href="tel:+233240547850">+233 24 054 7850</a>
          </article>
          <article>
            <p className="name">Ezekiel</p>
            <a href="tel:+233551730044">+233 55 173 0044</a>
          </article>
        </div>
      </section>

      <section className="block reception">
        <h2>Reception to Follow</h2>
        <p>@ ATIWA ONE LODGE</p>
      </section>
    </main>
  );
}
