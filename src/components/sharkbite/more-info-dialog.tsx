import { X } from "lucide-react";
import type { RefObject } from "react";
import styles from "./sharkbite.module.css";

type MoreInfoDialogProps = {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

export function MoreInfoDialog({ closeButtonRef, onClose }: MoreInfoDialogProps) {
  return (
    <div
      className={`${styles.inputDialogBackdrop} ${styles.infoDialogBackdrop}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-describedby="sharkbite-info-description"
        aria-labelledby="sharkbite-info-title"
        aria-modal="true"
        className={`${styles.inputDialog} ${styles.infoDialog}`}
        id="sharkbite-info"
        role="dialog"
      >
        <header className={styles.inputDialogHeader}>
          <h2 className={styles.inputDialogTitle} id="sharkbite-info-title">
            Sharkbite
          </h2>
          <button
            ref={closeButtonRef}
            aria-label="Close more info"
            className={`${styles.iconButton} ${styles.inputDialogClose}`}
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>

        <div className={styles.infoDialogBody} id="sharkbite-info-description">
          <p>
            Usually we think about latency as something to be avoided, but what if we harnessed it for its musicality?
            Sharkbite is a website that turns the internet into a delay pedal.
          </p>
          <p>
            Audio signal is sent to DigitalOcean servers in different cities, and back to you. Depending on how far you
            are away from these servers, you will hear a different delay effect; the delay time comes from the length of
            the trip itself.
          </p>
          <p>
            Conceptually, the internet is shrouded in metaphors of immateriality (&quot;the cloud&quot;, etc.), but in
            reality is a physical thing made possible by server farms and {" "}
            <a href="https://theconversation.com/undersea-cables-are-the-unseen-backbone-of-the-global-internet-226300" rel="noreferrer" target="_blank">
              undersea cables
            </a>. The name &quot;Sharkbite&quot; is
            a reference to a notorious{" "}
            <a href="https://www.youtube.com/watch?v=1ex7uTQf4bQ" rel="noreferrer" target="_blank">
              video
            </a>{" "}
            of a shark biting one of these undersea cables.
          </p>
          <footer className={styles.infoCreator}>
            <span>Created by Andrew Boylan</span>
            <nav aria-label="Andrew Boylan links" className={styles.infoCreatorLinks}>
              <a
                aria-label="Andrew Boylan on Instagram"
                className={styles.infoCreatorLink}
                href="https://www.instagram.com/ndrewboylan/"
                rel="noreferrer"
                target="_blank"
              >
                <svg aria-hidden="true" viewBox="0 0 448 512">
                  <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
                </svg>
              </a>
              <a
                aria-label="Andrew Boylan website"
                className={styles.infoCreatorLink}
                href="https://www.andrew-boylan.com/"
                rel="noreferrer"
                target="_blank"
              >
                <svg aria-hidden="true" viewBox="0 0 512 512">
                  <path d="M352 256c0 22.2-1.2 43.6-3.3 64l-185.3 0c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64l185.3 0c2.2 20.4 3.3 41.8 3.3 64zm28.8-64l123.1 0c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64l-123.1 0c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32l-116.7 0c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0l-176.6 0c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0L18.6 160C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192l123.1 0c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64L8.1 320C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6l176.6 0c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352l116.7 0zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6l116.7 0z" />
                </svg>
              </a>
              <a
                aria-label="Andrew Boylan on GitHub"
                className={styles.infoCreatorLink}
                href="https://github.com/eastmountaincode"
                rel="noreferrer"
                target="_blank"
              >
                <svg aria-hidden="true" viewBox="0 0 496 512">
                  <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
                </svg>
              </a>
            </nav>
          </footer>
        </div>
      </section>
    </div>
  );
}
