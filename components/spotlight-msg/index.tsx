import { useEffect, useRef } from 'react';
import Image from 'next/image';

import CTALink, { CTALinkProps } from './cta-link';
import styles from './spotlight-msg.module.scss';

export interface SpotlightMsgProps {
  gray?: boolean;
  flipped?: boolean;
  headline: string;
  body: string;
  label: string;
  img: string;
  cta: CTALinkProps;
}

export default function SpotlightMsg({
  gray,
  flipped,
  headline,
  body,
  label,
  img,
  cta,
}: SpotlightMsgProps): JSX.Element {
  const imgRef = useRef<HTMLDivElement>(null);
  const colorClass: string = gray ? styles.featureSpotlightGray : '';

  useEffect(() => {
    if (imgRef.current) {
      const init = async (elem: HTMLDivElement) => {
        const { default: VanillaTilt } = await import('vanilla-tilt');
        VanillaTilt.init(elem, { max: 10 });
      };
      void init(imgRef.current);
    }
  }, [imgRef]);

  return (
    <div className={styles.spotlight}>
      <div className={`${styles.featureSpotlight} ${colorClass}`}>
        <div className={styles.featureSpotlightBackground}>
          <div
            className={
              styles.featureSpotlightLead +
              (flipped ? ` ${styles.featureSpotlightLeadFlipped}` : '')
            }
          >
            <div className={styles.featureSpotlightIconWrapper}>
              <div className={styles.featureSpotlightIconText}>
                <span>{label}</span>
              </div>
            </div>
            <h2 className={styles.featureSpotlightHeading}>{headline}</h2>
            <div className={styles.featureSpotlightSubheading}>{body}</div>
          </div>
          <div
            className={`${styles.featureSpotlightChildren} ${
              styles.featureSpotlightChildrenZippered
            }${flipped ? ` ${styles.featureSpotlightChildrenFlipped}` : ''}`}
          >
            <div className={styles.featureSpotlightCTA}>
              <CTALink {...cta} />
            </div>
          </div>
          <div
            ref={imgRef}
            className={
              styles.featureSpotlightMedia +
              (flipped ? ` ${styles.featureSpotlightMediaFlipped}` : '')
            }
          >
            <Image
              width={645}
              height={485}
              layout='intrinsic'
              className={styles.featureSpotlightMediaImg}
              src={img}
              alt=''
            />
          </div>
        </div>
      </div>
    </div>
  );
}

SpotlightMsg.defaultProps = { gray: false, flipped: false };
