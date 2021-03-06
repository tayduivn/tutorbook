import {
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { TextField } from '@rmwc/textfield';
import to from 'await-to-js';
import useTranslation from 'next-translate/useTranslation';
import { v4 as uuid } from 'uuid';

import SubjectSelect, { SubjectOption } from 'components/subject-select';
import UserSelect, { UserOption } from 'components/user-select';
import Button from 'components/button';
import Result from 'components/search/result';
import TimeSelect from 'components/time-select';

import {
  Aspect,
  Callback,
  Match,
  MatchJSON,
  Person,
  Timeslot,
  User,
  UserJSON,
} from 'lib/model';
import { APIError } from 'lib/api/error';
import { period } from 'lib/utils';
import { useOrg } from 'lib/context/org';
import { useUser } from 'lib/context/user';

import styles from './form-page.module.scss';

export interface MatchPageProps {
  value: UserJSON;
  openDisplay: () => void;
  loading: boolean;
  setLoading: Callback<boolean>;
  setChecked: Callback<boolean>;
}

export default memo(function MatchPage({
  value,
  openDisplay,
  loading,
  setLoading,
  setChecked,
}: MatchPageProps): JSX.Element {
  const { org } = useOrg();
  const { user } = useUser();
  const { t } = useTranslation();

  const [error, setError] = useState<string>('');

  const aspects = useRef<Set<Aspect>>(new Set());
  const [students, setStudents] = useState<UserOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [message, setMessage] = useState<string>('');
  const [time, setTime] = useState<Timeslot>();

  const msgPlaceholder = useMemo(
    () =>
      t('match:message-placeholder', {
        student: students[0] ? students[0].label.split(' ')[0] : 'Nick',
        subject: subjects[0] ? subjects[0].label : 'Computer Science',
        tutor: value.name.split(' ')[0],
      }),
    [t, students, subjects, value.name]
  );

  const onMessageChange = useCallback((evt: FormEvent<HTMLInputElement>) => {
    setMessage(evt.currentTarget.value);
  }, []);
  const onMessageFocus = useCallback(() => {
    setMessage((prev: string) => prev || msgPlaceholder.replace('Ex: ', ''));
  }, [msgPlaceholder]);

  useEffect(() => {
    subjects.forEach((s) => {
      if (s.aspect) aspects.current.add(s.aspect);
    });
  }, [subjects]);
  useEffect(() => {
    const options = [...value.tutoring.subjects, ...value.mentoring.subjects];
    setSubjects((prev: SubjectOption[]) => {
      const selected: Set<string> = new Set();
      prev.forEach((subject: SubjectOption) => {
        if (options.includes(subject.value)) selected.add(subject.value);
      });
      return [...selected].map((s) => ({ label: s, value: s }));
    });
  }, [value.tutoring.subjects, value.mentoring.subjects]);

  const match = useMemo(() => {
    const asps: Aspect[] = [...aspects.current];
    const target: Person = {
      id: value.id,
      name: value.name,
      photo: value.photo,
      roles: [],
      handle: uuid(),
    };
    if (asps.includes('tutoring')) target.roles.push('tutor');
    if (asps.includes('mentoring')) target.roles.push('mentor');
    const people: Person[] = [
      target,
      ...students.map((s: UserOption) => {
        const student: Person = {
          id: s.value,
          name: s.label,
          photo: s.photo || '',
          roles: [],
          handle: uuid(),
        };
        if (asps.includes('tutoring')) student.roles.push('tutee');
        if (asps.includes('mentoring')) student.roles.push('mentee');
        return student;
      }),
    ];
    return new Match({
      time,
      people,
      message,
      org: org?.id || 'default',
      subjects: subjects.map((s) => s.value),
      creator: {
        id: user.id,
        name: user.name,
        photo: user.photo,
        roles: [],
        handle: uuid(),
      },
    });
  }, [value, user, students, subjects, message, time, org?.id]);

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setLoading(true);
      const [err] = await to<AxiosResponse<MatchJSON>, AxiosError<APIError>>(
        axios.post('/api/matches', match.toJSON())
      );
      if (err && err.response) {
        setLoading(false);
        setError(
          `An error occurred while creating your match. ${period(
            (err.response.data || err).message
          )}`
        );
      } else if (err && err.request) {
        setLoading(false);
        setError(
          'An error occurred while creating your match. Please check your ' +
            'Internet connection and try again.'
        );
      } else if (err) {
        setLoading(false);
        setError(
          `An error occurred while creating your match. ${period(
            err.message
          )} Please check your Internet connection and try again.`
        );
      } else {
        setChecked(true);
        // Wait one sec to show checkmark animation before hiding the loading
        // overlay and letting the user edit their newly created/updated user.
        setTimeout(() => {
          setLoading(false);
          openDisplay();
        }, 1000);
      }
    },
    [match, openDisplay, setLoading, setChecked]
  );

  return (
    <div className={styles.content}>
      <Result user={User.fromJSON(value)} className={styles.display} />
      <form className={styles.form} onSubmit={onSubmit}>
        <UserSelect
          required
          label={t('common:students')}
          onSelectedChange={setStudents}
          selected={students}
          className={styles.field}
          renderToPortal
          outlined
        />
        <SubjectSelect
          required
          autoOpenMenu
          options={[...value.tutoring.subjects, ...value.mentoring.subjects]}
          label={t('common:subjects')}
          onSelectedChange={setSubjects}
          selected={subjects}
          className={styles.field}
          renderToPortal
          outlined
        />
        <TimeSelect
          required
          uid={value.id}
          label={t('common:time')}
          onChange={setTime}
          value={time}
          className={styles.field}
          renderToPortal
          outlined
        />
        <TextField
          textarea
          rows={4}
          required
          characterCount
          maxLength={700}
          label={t('common:message')}
          placeholder={msgPlaceholder}
          onChange={onMessageChange}
          onFocus={onMessageFocus}
          value={message}
          className={styles.field}
          outlined
        />
        <Button
          className={styles.btn}
          label={t('match:create-btn')}
          disabled={loading}
          raised
          arrow
        />
        {!!error && <div className={styles.error}>{error}</div>}
      </form>
    </div>
  );
});
