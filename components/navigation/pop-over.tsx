import { Fragment, useState } from 'react';
import { MenuSurface, MenuSurfaceAnchor } from '@rmwc/menu';
import { FormField } from '@rmwc/formfield';
import { Icon } from '@rmwc/icon';
import { Ripple } from '@rmwc/ripple';
import { Switch } from '@rmwc/switch';
import cn from 'classnames';
import useTranslation from 'next-translate/useTranslation';

import Avatar from 'components/avatar';
import Intercom from 'lib/intercom';

import { AccountInterface, Org, User } from 'lib/model';
import Link from 'lib/intl/link';
import { useTheme } from 'lib/context/theme';
import { useUser } from 'lib/context/user';

import styles from './pop-over.module.scss';

interface PopOverLinkProps {
  href: string;
  children: string;
  icon?: string;
}

export function PopOverLink({
  href,
  children,
  icon,
}: PopOverLinkProps): JSX.Element {
  return (
    /* eslint-disable jsx-a11y/anchor-is-valid */
    <Ripple>
      <div className={styles.item}>
        {icon && (
          <div className={styles.icon}>
            <Icon icon={icon} />
          </div>
        )}
        <Link href={href}>
          <a className={styles.itemLink}>{children}</a>
        </Link>
      </div>
    </Ripple>
    /* eslint-enable jsx-a11y/anchor-is-valid */
  );
}

interface PopOverButtonProps {
  onClick: () => void;
  children: string;
  icon?: string;
  id?: string;
}

export function PopOverButton({
  onClick,
  children,
  icon,
  id,
}: PopOverButtonProps): JSX.Element {
  return (
    <Ripple>
      <button id={id} type='button' onClick={onClick} className={styles.item}>
        {icon && (
          <div className={styles.icon}>
            <Icon icon={icon} />
          </div>
        )}
        <span className={styles.label}>{children}</span>
      </button>
    </Ripple>
  );
}

export function DarkModeSwitch(): JSX.Element {
  const { t } = useTranslation();
  const { dark, setTheme } = useTheme();

  return (
    <FormField className={cn(styles.item, styles.switch)}>
      <div className={styles.icon}>
        <Switch
          id='dark-mode'
          checked={dark}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        />
      </div>
      <label htmlFor='dark-mode' className={styles.label}>
        {t('common:toggle-theme')}
      </label>
    </FormField>
  );
}

interface PopOverAccountProps {
  account: AccountInterface;
}

export function PopOverAccountButton({
  account,
  onClick,
}: { onClick: () => void } & PopOverAccountProps): JSX.Element {
  return (
    <Ripple>
      <button type='button' onClick={onClick} className={styles.item}>
        <div className={styles.avatar}>
          <Avatar size={24} src={account.photo} />
        </div>
        <span className={styles.label}>{account.name}</span>
      </button>
    </Ripple>
  );
}

export function PopOverAccountHeader({
  account,
}: PopOverAccountProps): JSX.Element {
  return (
    <div data-cy='account-header' className={cn(styles.item, styles.header)}>
      <div className={styles.avatar}>
        <Avatar size={24} src={account.photo} />
      </div>
      <span className={styles.label}>{account.name}</span>
    </div>
  );
}

export function PopOverAccountLink({
  account,
  href,
}: { href: string } & PopOverAccountProps): JSX.Element {
  return (
    /* eslint-disable jsx-a11y/anchor-is-valid */
    <Ripple>
      <div className={styles.item}>
        <Link href={href}>
          <a className={styles.itemLink}>
            <div className={styles.avatar}>
              <Avatar size={24} src={account.photo} />
            </div>
            <span className={styles.label}>{account.name}</span>
          </a>
        </Link>
      </div>
    </Ripple>
    /* eslint-enable jsx-a11y/anchor-is-valid */
  );
}

interface PopOverMenuProps {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
}

export default function PopOverMenu({
  open,
  onClose,
  children,
}: PopOverMenuProps): JSX.Element {
  const { t } = useTranslation();
  const { user, updateUser, orgs } = useUser();

  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  return (
    <MenuSurfaceAnchor className={styles.anchor}>
      {children}
      <MenuSurface open={open} onClose={onClose}>
        <div data-cy='picker' className={styles.picker}>
          <PopOverAccountHeader account={user} />
          <PopOverLink href='/'>{t('common:home')}</PopOverLink>
          <PopOverLink href={`/${user.orgs[0] || 'default'}/search`}>
            {t('common:search')}
          </PopOverLink>
          <PopOverLink href='/profile'>{t('common:profile')}</PopOverLink>
          <PopOverLink href='/dashboard'>{t('common:dashboard')}</PopOverLink>
          {orgs.map((org: Org) => (
            <Fragment key={org.id}>
              <div className={styles.line} />
              <PopOverAccountHeader account={org} />
              <PopOverLink href={`/${org.id}`}>{t('common:home')}</PopOverLink>
              <PopOverLink href={`/${org.id}/search`}>
                {t('common:search')}
              </PopOverLink>
              <PopOverLink href={`/${org.id}/people`}>
                {t('common:people')}
              </PopOverLink>
              <PopOverLink href={`/${org.id}/matches`}>
                {t('common:matches')}
              </PopOverLink>
              <PopOverLink href={`/${org.id}/settings`}>
                {t('common:settings')}
              </PopOverLink>
            </Fragment>
          ))}
          <div className={styles.line} />
          <PopOverButton
            id='create-org'
            icon='add'
            onClick={() => Intercom('showNewMessage', t('common:new-org-msg'))}
          >
            {t('common:new-org-btn')}
          </PopOverButton>
          <PopOverButton
            id='get-help'
            icon='contact_support'
            onClick={() => Intercom('show')}
          >
            {t('common:launch-intercom')}
          </PopOverButton>
          <div className={styles.line} />
          <DarkModeSwitch />
          <div className={styles.line} />
          <PopOverButton
            id='logout'
            onClick={async () => {
              // TODO: Logging out when on the profile page which has a
              // `useContinuous` hook attached to this user object doesn't work.
              setLoggingOut(true);
              const { default: firebase } = await import('lib/firebase');
              await import('firebase/auth');
              await firebase.auth().signOut();
              await updateUser(new User());
              window.analytics?.reset();
              Intercom('shutdown');
              Intercom('boot');
            }}
          >
            {t(loggingOut ? 'common:logging-out' : 'common:logout')}
          </PopOverButton>
        </div>
      </MenuSurface>
    </MenuSurfaceAnchor>
  );
}
