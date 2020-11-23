import { NextApiRequest as Req, NextApiResponse as Res } from 'next';

import { Meeting, MeetingJSON, isMeetingJSON } from 'lib/model';
import createMeetingDoc from 'lib/api/create/meeting-doc';
import getMatch from 'lib/api/get/match';
import { handle } from 'lib/api/error';
import verifyAuth from 'lib/api/verify/auth';
import verifyBody from 'lib/api/verify/body';
import verifyQueryId from 'lib/api/verify/query-id';

export type CreateMeetingRes = MeetingJSON;

export default async function createMeeting(
  req: Req,
  res: Res<CreateMeetingRes>
): Promise<void> {
  try {
    const id = verifyQueryId(req.query);
    const match = await getMatch(id);

    // TODO: Right now this only responds to admin requests but we want it to
    // respond to any of the match's people as well.
    await verifyAuth(req.headers, { orgIds: [match.org] });

    const body = verifyBody<Meeting, MeetingJSON>(
      req.body,
      isMeetingJSON,
      Meeting
    );
    const meeting = await createMeetingDoc(body, id);

    res.status(200).json(meeting.toJSON());
  } catch (e) {
    handle(e, res);
  }
}
