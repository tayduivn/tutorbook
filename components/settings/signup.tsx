import { useCallback, FormEvent } from 'react';
import { TextField } from '@rmwc/textfield';
import useTranslation from 'next-translate/useTranslation';

import { Aspect, Org } from 'lib/model';

import { useSettings } from './context';
import styles from './settings.module.scss';

export default function Signup(): JSX.Element {
  const { t, lang: locale } = useTranslation();
  const { org, setOrg } = useSettings();

  const onHeaderChange = useCallback(
    (evt: FormEvent<HTMLInputElement>, aspect: Aspect) => {
      const header = evt.currentTarget.value;
      setOrg((prev: Org) => {
        const signup = {
          ...prev.signup,
          [locale]: {
            ...prev.signup[locale],
            [aspect]: {
              ...prev.signup[locale][aspect],
              header,
            },
          },
        };
        return new Org({ ...prev, signup });
      });
    },
    [locale, setOrg]
  );
  const onBodyChange = useCallback(
    (evt: FormEvent<HTMLInputElement>, aspect: Aspect) => {
      const body = evt.currentTarget.value;
      setOrg((prev: Org) => {
        const signup = {
          ...prev.signup,
          [locale]: {
            ...prev.signup[locale],
            [aspect]: {
              ...prev.signup[locale][aspect],
              body,
            },
          },
        };
        return new Org({ ...prev, signup });
      });
    },
    [locale, setOrg]
  );

  return (
    <div className={styles.card}>
      {org.aspects.map((aspect: Aspect, idx: number) => (
        <>
          {idx > 0 && <div className={styles.divider} />}
          <div className={styles.inputs}>
            <TextField
              label={t(`org:signup-${aspect}-header`)}
              placeholder={t(`org:signup-${aspect}-header-placeholder`)}
              value={(org.signup[locale][aspect] || {}).header || ''}
              onChange={(evt) => onHeaderChange(evt, aspect)}
              className={styles.field}
              outlined
              required
            />
            <TextField
              label={t(`org:signup-${aspect}-body`)}
              placeholder={t(`org:signup-${aspect}-body-placeholder`)}
              value={(org.signup[locale][aspect] || {}).body || ''}
              onChange={(evt) => onBodyChange(evt, aspect)}
              className={styles.field}
              outlined
              required
              rows={8}
              textarea
            />
          </div>
        </>
      ))}
    </div>
  );
}
