import {
  Email,
  Footer,
  Header,
  Item,
  Link,
  P,
  Quote,
} from 'lib/mail/components';
import { Match, UserWithRoles } from 'lib/model';
import { join } from 'lib/utils';

export interface DirectMatchEmailProps {
  match: Match;
  recipient: UserWithRoles;
  creator: UserWithRoles;
}

/**
 * Email sent to the recipient of a match sent via the `RequestDialog` directly
 * by a student. Includes the match subjects and message.
 * @todo Specify the match time and include link to Jitsi/Zoom meeting room.
 */
export default function DirectMatchEmail({
  match,
  recipient,
  creator,
}: DirectMatchEmailProps): JSX.Element {
  return (
    <Email>
      <Header />
      <Item>
        <P style={{ marginTop: '0px !important' }}>
          Hi {recipient.name.split(' ').shift()},
        </P>
        <P>
          {creator.name} wants you as a {join(recipient.roles)} for{' '}
          {join(match.subjects)}:
        </P>
        <Quote text={match.message} cite={creator.name} />
        <P>
          If you&apos;re interested, please get in touch with {creator.name} by
          replying to this email or using the following email address:
        </P>
        <P>
          <Link href={`mailto:${creator.email}`}>{creator.email}</Link>
        </P>
        <P style={{ marginBottom: '0px !important' }}>Thank you.</P>
      </Item>
      <Footer>
        <P>
          This email was sent to you because you have a visible profile on
          Tutorbook. You can edit or remove your profile{' '}
          <Link href='https://tutorbook.app/profile'>here</Link>.
        </P>
        <P style={{ marginBottom: '0px !important' }}>
          If this message contains spam or unwanted messages let us know at{' '}
          <Link href='mailto:team@tutorbook.org'>team@tutorbook.org</Link>.
        </P>
      </Footer>
    </Email>
  );
}
