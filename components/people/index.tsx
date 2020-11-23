import Router, { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { Page, UserDialogProps } from 'components/user-dialog';
import Pagination from 'components/pagination';

import { Org, User, UserJSON, UsersQuery } from 'lib/model';

import FiltersSheet from './filters-sheet';
import Header from './header';
import ResultsList from './results-list';
import SearchBar from './search-bar';
import styles from './people.module.scss';

const UserDialog = dynamic<UserDialogProps>(() =>
  import('components/user-dialog')
);

interface PeopleProps {
  org: Org;
}

/**
 * The "People" view is a fully filterable list of users that can be clicked on
 * to open a "UserDialog" that includes:
 * - Profile editing
 * - Convenient contact actions (i.e. email a certain user)
 * This component merely acts as a shared state provider by passing down state
 * variables and their corresponding `setState` callbacks.
 * @todo Ensure that child components are wrapped in `React.memo`s so that they
 * don't re-render due to irrelevant state changes.
 * @see {@link https://github.com/tutorbookapp/tutorbook/issues/87}
 * @see {@link https://github.com/tutorbookapp/tutorbook/issues/75}
 */
export default function People({ org }: PeopleProps): JSX.Element {
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<UsersQuery>(
    new UsersQuery({
      orgs: [{ label: org.name, value: org.id }],
      hitsPerPage: 5,
    })
  );
  const [hits, setHits] = useState<number>(query.hitsPerPage);

  const {
    query: { slug },
  } = useRouter();
  const [viewing, setViewing] = useState<UserJSON | undefined>(() => {
    if (!slug || !slug[0]) return;
    return new User({ id: slug[0] }).toJSON();
  });

  const onViewingClosed = useCallback(() => setViewing(undefined), []);

  useEffect(() => {
    setQuery(
      (prev: UsersQuery) =>
        new UsersQuery({
          ...prev,
          orgs: [{ label: org.name, value: org.id }],
        })
    );
  }, [org]);
  useEffect(() => {
    const url = `/${org.id}/people/${viewing?.id || ''}`;
    void Router.replace(url, undefined, { shallow: true });
  }, [org.id, viewing?.id]);

  const initialPage = useMemo(() => {
    if (!viewing || !viewing.id || viewing.id.startsWith('temp'))
      return Page.Edit;
    return Page.Display;
  }, [viewing]);

  return (
    <>
      {viewing && (
        <UserDialog
          onClosed={onViewingClosed}
          initialData={viewing}
          initialPage={initialPage}
        />
      )}
      <Header orgId={org.id} orgName={org.name} setViewing={setViewing} />
      <div className={styles.wrapper}>
        <SearchBar query={query} setQuery={setQuery} setOpen={setFiltersOpen} />
        <div className={styles.content}>
          <FiltersSheet open={filtersOpen} query={query} setQuery={setQuery} />
          <ResultsList
            open={filtersOpen}
            query={query}
            setHits={setHits}
            setViewing={setViewing}
          />
        </div>
        <Pagination query={query} setQuery={setQuery} hits={hits} />
      </div>
    </>
  );
}
