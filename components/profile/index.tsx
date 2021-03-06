import { FormEvent, useCallback } from 'react';
import { Snackbar, SnackbarAction } from '@rmwc/snackbar';
import { TextField } from '@rmwc/textfield';
import axios from 'axios';
import useTranslation from 'next-translate/useTranslation';

import AvailabilitySelect from 'components/availability-select';
import Header from 'components/header';
import LangSelect from 'components/lang-select';
import PhotoInput from 'components/photo-input';
import SubjectSelect from 'components/subject-select';

import { Availability, User, UserJSON } from 'lib/model';
import {
  useAnalytics,
  useContinuous,
  useSocialProps,
  useTrack,
} from 'lib/hooks';
import { useUser } from 'lib/context/user';

import styles from './profile.module.scss';

export default function Profile(): JSX.Element {
  const { t } = useTranslation();
  const { user: local, updateUser: updateLocal } = useUser();

  const track = useTrack();
  const updateRemote = useCallback(
    async (updated: User) => {
      const url = `/api/users/${updated.id}`;
      const { data } = await axios.put<UserJSON>(url, updated.toJSON());
      track('Profile Updated', updated.toSegment());
      return User.fromJSON(data);
    },
    [track]
  );

  const { error, retry, timeout, data: user, setData: setUser } = useContinuous<
    User
  >(local, updateRemote, updateLocal);

  useAnalytics(
    'Profile Errored',
    () => error && { ...user.toSegment(), error }
  );

  const onNameChange = useCallback(
    (evt: FormEvent<HTMLInputElement>) => {
      const name = evt.currentTarget.value;
      setUser((prev) => new User({ ...prev, name }));
    },
    [setUser]
  );
  const onPhoneChange = useCallback(
    (evt: FormEvent<HTMLInputElement>) => {
      const phone = evt.currentTarget.value;
      setUser((prev) => new User({ ...prev, phone }));
    },
    [setUser]
  );
  const onPhotoChange = useCallback(
    (photo: string) => {
      setUser((prev) => new User({ ...prev, photo }));
    },
    [setUser]
  );
  const onBioChange = useCallback(
    (evt: FormEvent<HTMLInputElement>) => {
      const bio = evt.currentTarget.value;
      setUser((prev) => new User({ ...prev, bio }));
    },
    [setUser]
  );
  const onAvailabilityChange = useCallback(
    (availability: Availability) => {
      setUser((prev) => new User({ ...prev, availability }));
    },
    [setUser]
  );
  const onMentoringSubjectsChange = useCallback(
    (subjects: string[]) => {
      setUser(
        (prev) =>
          new User({ ...prev, mentoring: { ...prev.mentoring, subjects } })
      );
    },
    [setUser]
  );
  const onTutoringSubjectsChange = useCallback(
    (subjects: string[]) => {
      setUser(
        (prev) =>
          new User({ ...prev, tutoring: { ...prev.tutoring, subjects } })
      );
    },
    [setUser]
  );
  const onLangsChange = useCallback(
    (langs: string[]) => {
      setUser((prev) => new User({ ...prev, langs }));
    },
    [setUser]
  );

  const getSocialProps = useSocialProps(
    user,
    setUser,
    styles.field,
    'user3rd',
    User
  );

  return (
    <>
      {error && (
        <Snackbar
          className={styles.snackbar}
          message={t('profile:error', { count: timeout / 1000 })}
          timeout={-1}
          action={<SnackbarAction label={t('profile:retry')} onClick={retry} />}
          leading
          open
        />
      )}
      <Header
        header={t('common:profile')}
        body={t('profile:subtitle')}
        actions={[
          {
            label: t('profile:view-profile'),
            href: `/${user.orgs[0] || 'default'}/search/${user.id}`,
          },
        ]}
      />
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <div className={styles.inputs}>
            <TextField
              label={t('user3rd:name')}
              value={user.name}
              onChange={onNameChange}
              className={styles.field}
              required
              outlined
            />
            <TextField
              label={t('user3rd:email')}
              value={user.email}
              className={styles.field}
              type='email'
              disabled
              readOnly
              required
              outlined
            />
            <TextField
              label={t('user3rd:phone')}
              value={user.phone ? user.phone : undefined}
              onChange={onPhoneChange}
              className={styles.field}
              type='tel'
              outlined
            />
            <PhotoInput
              label={t('user3rd:photo')}
              value={user.photo}
              onChange={onPhotoChange}
              className={styles.field}
              outlined
            />
          </div>
          <div className={styles.divider} />
          <div className={styles.inputs}>
            <LangSelect
              className={styles.field}
              label={t('user3rd:langs')}
              placeholder={t('common:langs-placeholder')}
              onChange={onLangsChange}
              value={user.langs}
              outlined
            />
            <AvailabilitySelect
              className={styles.field}
              label={t('user3rd:availability')}
              onChange={onAvailabilityChange}
              value={user.availability}
              outlined
            />
            <TextField
              label={t('user3rd:bio')}
              placeholder={t('user3rd:bio-placeholder', {
                name: user.name || 'Tutorbook',
              })}
              value={user.bio}
              onChange={onBioChange}
              className={styles.field}
              outlined
              rows={8}
              textarea
            />
          </div>
          <div className={styles.divider} />
          <div className={styles.inputs}>
            <SubjectSelect
              className={styles.field}
              label={t('user3rd:tutoring-subjects')}
              onChange={onTutoringSubjectsChange}
              value={user.tutoring.subjects}
              placeholder={t('common:tutoring-subjects-placeholder')}
              aspect='tutoring'
              outlined
            />
            <SubjectSelect
              className={styles.field}
              label={t('user3rd:mentoring-subjects')}
              onChange={onMentoringSubjectsChange}
              value={user.mentoring.subjects}
              placeholder={t('common:mentoring-subjects-placeholder')}
              aspect='mentoring'
              outlined
            />
          </div>
          <div className={styles.divider} />
          <div className={styles.inputs}>
            <TextField {...getSocialProps('website')} />
            <TextField {...getSocialProps('facebook')} />
            <TextField {...getSocialProps('instagram')} />
            <TextField {...getSocialProps('twitter')} />
            <TextField {...getSocialProps('linkedin')} />
            <TextField {...getSocialProps('github')} />
            <TextField {...getSocialProps('indiehackers')} />
          </div>
        </div>
      </div>
    </>
  );
}
