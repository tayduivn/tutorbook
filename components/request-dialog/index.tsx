import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { Dialog } from '@rmwc/dialog';
import { TextField } from '@rmwc/textfield';
import cn from 'classnames';
import to from 'await-to-js';
import useTranslation from 'next-translate/useTranslation';
import { v4 as uuid } from 'uuid';

import Avatar from 'components/avatar';
import Button from 'components/button';
import Loader from 'components/loader';
import SubjectSelect from 'components/subject-select';
import TimeSelect from 'components/time-select';

import {
  Aspect,
  Match,
  MatchJSON,
  Person,
  SocialInterface,
  Timeslot,
  User,
  UserJSON,
} from 'lib/model';
import { useAnalytics, useTrack } from 'lib/hooks';
import { APIErrorJSON } from 'lib/api/error';
import { period } from 'lib/utils';
import { signupWithGoogle } from 'lib/firebase/signup';
import { useOrg } from 'lib/context/org';
import { useUser } from 'lib/context/user';

import styles from './request-dialog.module.scss';

export interface RequestDialogProps {
  onClosed: () => void;
  subjects: string[];
  aspect: Aspect;
  user: User;
}

export default function RequestDialog({
  subjects: initialSubjects,
  onClosed,
  aspect,
  user,
}: RequestDialogProps): JSX.Element {
  const [open, setOpen] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();

  const { t } = useTranslation();

  const { org } = useOrg();
  const { user: currentUser, updateUser } = useUser();

  const [subjects, setSubjects] = useState<string[]>(initialSubjects);
  const [message, setMessage] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [time, setTime] = useState<Timeslot>();

  // We have to use React refs in order to access updated state information in
  // a callback that was called (and thus was also defined) before the update.
  const match = useRef<Match>(new Match());
  useEffect(() => {
    const creator: Person = {
      id: currentUser.id,
      name: currentUser.name,
      photo: currentUser.photo,
      handle: uuid(),
      roles: [aspect === 'tutoring' ? 'tutee' : 'mentee'],
    };
    const target: Person = {
      id: user.id,
      name: user.name,
      photo: user.photo,
      handle: uuid(),
      roles: [aspect === 'tutoring' ? 'tutor' : 'mentor'],
    };
    match.current = new Match({
      time,
      creator,
      message,
      subjects,
      org: org?.id || 'default',
      people: [target, creator],
    });
  }, [currentUser, user, aspect, message, subjects, time, org?.id]);

  useAnalytics('Match Subjects Updated', () => ({
    subjects,
    user: user.toSegment(),
  }));
  useAnalytics('Match Time Updated', () => ({
    time: time?.toSegment(),
    user: user.toSegment(),
  }));
  useAnalytics('Match Message Updated', () => ({
    message,
    user: user.toSegment(),
  }));
  useAnalytics(
    'Match Errored',
    () =>
      error && { ...match.current.toSegment(), user: user.toSegment(), error }
  );

  const onMessageChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    setMessage(event.currentTarget.value);
  }, []);
  const onPhoneChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    setPhone(event.currentTarget.value);
  }, []);

  const phoneRequired = useMemo(() => {
    return org ? org.profiles.includes('phone') : false;
  }, [org]);

  const track = useTrack();

  // Signup the user via a Google Popup window if they aren't current logged in
  // **before** sending the request (this will trigger an update app-wide).
  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      if (!currentUser.id) {
        const [err] = await to(signupWithGoogle(currentUser));
        if (err) {
          setLoading(false);
          setError(
            `An error occurred while logging in with Google. ${err.message}`
          );
          return;
        }
      } else if (!currentUser.phone && phoneRequired) {
        const [err, res] = await to<
          AxiosResponse<UserJSON>,
          AxiosError<APIErrorJSON>
        >(
          axios.put(`/api/users/${currentUser.id}`, {
            ...currentUser.toJSON(),
            phone,
          })
        );
        if (err && err.response) {
          setLoading(false);
          setError(
            `An error occurred while adding your phone number. ${period(
              (err.response.data || err).message
            )}`
          );
          return;
        }
        if (err && err.request) {
          setLoading(false);
          setError(
            'An error occurred while adding your phone number. Please check ' +
              'your Internet connection and try again.'
          );
          return;
        }
        if (err) {
          setLoading(false);
          setError(
            `An error occurred while adding your phone number. ${period(
              err.message
            )} Please check your Internet connection and try again.`
          );
          return;
        }
        await updateUser(User.fromJSON((res as AxiosResponse<UserJSON>).data));
      }
      const [err, res] = await to<
        AxiosResponse<MatchJSON>,
        AxiosError<APIErrorJSON>
      >(axios.post('/api/matches', match.current.toJSON()));
      if (err && err.response) {
        setLoading(false);
        setError(
          `An error occurred while sending your request. ${period(
            (err.response.data || err).message
          )}`
        );
      } else if (err && err.request) {
        setLoading(false);
        setError(
          'An error occurred while sending your request. Please check your ' +
            'Internet connection and try again.'
        );
      } else if (err) {
        setLoading(false);
        setError(
          `An error occurred while sending your request. ${period(
            err.message
          )} Please check your Internet connection and try again.`
        );
      } else {
        setChecked(true);
        const created = Match.fromJSON((res as AxiosResponse<MatchJSON>).data);
        track('Match Created', {
          ...created.toSegment(),
          user: user.toSegment(),
        });
        setTimeout(() => setOpen(false), 1000);
      }
    },
    [user, track, currentUser, phoneRequired, phone, updateUser]
  );

  return (
    <Dialog
      data-cy='request-dialog'
      open={open}
      onClosed={onClosed}
      className={styles.dialog}
    >
      <div className={styles.wrapper}>
        <Loader active={loading} checked={checked} />
        <div className={styles.left}>
          <a
            className={styles.img}
            href={user.photo}
            target='_blank'
            rel='noreferrer'
            tabIndex={-1}
          >
            <Avatar size={260} src={user.photo} />
          </a>
          <h4 data-cy='name' className={styles.name}>
            {user.name}
          </h4>
          {user.socials && !!user.socials.length && (
            <div data-cy='socials' className={styles.socials}>
              {user.socials.map((social: SocialInterface) => (
                <a
                  data-cy={`${social.type}-social-link`}
                  key={social.type}
                  target='_blank'
                  rel='noreferrer'
                  href={social.url}
                  className={`${styles.socialLink} ${styles[social.type]}`}
                >
                  {social.type}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className={styles.right}>
          <h6 className={styles.header}>{t('common:about')}</h6>
          <p data-cy='bio' className={styles.text}>
            {user.bio}
          </p>
          {!org?.matchURL && (
            <>
              <h6 className={styles.header}>{t('common:request')}</h6>
              <form className={styles.form} onSubmit={onSubmit}>
                {!currentUser.phone && phoneRequired && (
                  <TextField
                    label={t('match3rd:phone')}
                    value={phone}
                    onChange={onPhoneChange}
                    className={styles.field}
                    type='tel'
                    outlined
                    required
                  />
                )}
                <SubjectSelect
                  required
                  outlined
                  autoOpenMenu
                  renderToPortal
                  label={t('match3rd:subjects')}
                  className={styles.field}
                  onChange={setSubjects}
                  value={subjects}
                  options={user[aspect].subjects}
                  aspect={aspect}
                />
                <TimeSelect
                  required
                  outlined
                  renderToPortal
                  label={t('match3rd:time')}
                  className={styles.field}
                  onChange={setTime}
                  value={time}
                  uid={user.id}
                />
                <TextField
                  outlined
                  textarea
                  rows={4}
                  required
                  characterCount
                  maxLength={500}
                  placeholder={t('match3rd:message-placeholder', {
                    subject: subjects[0] || 'Computer Science',
                  })}
                  label={t('match3rd:message')}
                  className={styles.field}
                  onChange={onMessageChange}
                  value={message}
                />
                <Button
                  className={styles.button}
                  label={
                    !currentUser.id
                      ? t('match3rd:signup-btn')
                      : t('match3rd:send-btn')
                  }
                  disabled={loading}
                  google={!currentUser.id}
                  raised
                  arrow
                />
                {!!error && (
                  <div data-cy='error' className={styles.error}>
                    {error}
                  </div>
                )}
              </form>
            </>
          )}
          {!!org?.matchURL && (
            <>
              <h6 className={cn(styles.header, styles.picktime)}>
                {t('common:request')}
              </h6>
              <p className={styles.text}>
                {t('common:picktime-body', { org: org.name, user: user.name })}
              </p>
              <Button
                href={org.matchURL}
                className={cn(styles.button, styles.picktime)}
                label={t('common:picktime-btn')}
                raised
                arrow
              />
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
