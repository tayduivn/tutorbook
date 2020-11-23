import { FormEvent, useCallback, useEffect, useState } from 'react';
import Router from 'next/router';
import useTranslation from 'next-translate/useTranslation';

import Button from 'components/button';
import SubjectSelect from 'components/subject-select';

import { Option, UsersQuery } from 'lib/model';
import { useUser } from 'lib/context/user';

import styles from './search-form.module.scss';

export default function SearchForm(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useUser();

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [query, setQuery] = useState<UsersQuery>(
    new UsersQuery({ langs: [], subjects: [] })
  );

  useEffect(() => {
    void Router.prefetch(query.getURL(`/${user.orgs[0] || 'default'}/search`));
  }, [query, user.orgs]);

  const onSubjectsChange = useCallback((subjects: Option<string>[]) => {
    setQuery((prev: UsersQuery) => new UsersQuery({ ...prev, subjects }));
  }, []);

  const onSubmit = useCallback(
    (evt: FormEvent<HTMLFormElement>) => {
      evt.preventDefault();
      setSubmitting(true);
      return Router.push(query.getURL(`/${user.orgs[0] || 'default'}/search`));
    },
    [query, user.orgs]
  );
  const searchMentors = useCallback(
    (evt: FormEvent<HTMLButtonElement>) => {
      evt.preventDefault();
      evt.stopPropagation();
      setSubmitting(true);
      const qry = new UsersQuery({ ...query, aspect: 'mentoring' });
      return Router.push(qry.getURL(`/${user.orgs[0] || 'default'}/search`));
    },
    [query, user.orgs]
  );
  const searchTutors = useCallback(
    (evt: FormEvent<HTMLButtonElement>) => {
      evt.preventDefault();
      evt.stopPropagation();
      setSubmitting(true);
      const qry = new UsersQuery({ ...query, aspect: 'tutoring' });
      return Router.push(qry.getURL(`/${user.orgs[0] || 'default'}/search`));
    },
    [query, user.orgs]
  );

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <SubjectSelect
        label={t('query3rd:subjects')}
        onSelectedChange={onSubjectsChange}
        selected={query.subjects}
        placeholder={t('common:subjects-placeholder')}
        className={styles.field}
        renderToPortal
        outlined
      />
      <Button
        onClick={searchMentors}
        className={styles.btn}
        label={t('query3rd:mentoring-btn')}
        disabled={submitting}
        raised
        arrow
      />
      <Button
        onClick={searchTutors}
        className={styles.btn}
        label={t('query3rd:tutoring-btn')}
        disabled={submitting}
        raised
        arrow
      />
    </form>
  );
}
