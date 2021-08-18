import { Actions, StateHelper } from '@twilio/flex-ui';
import { acceptInternalTask, rejectInternalTask, isInternalCall, toggleHoldInternalCall } from './internalCall';
import { kickExternalTransferParticipant } from './externalTransfer';
import ConferenceService from '../helpers/ConferenceService';
import { partition } from 'lodash-es';

export default (manager) => {

  Actions.addListener('beforeAcceptTask', (payload, abortFunction) => {

    const reservation = payload.task.sourceObject;

    if (isInternalCall(payload)) {

      abortFunction();

      acceptInternalTask({ reservation, payload });

    }

  })

  Actions.addListener('beforeRejectTask', (payload, abortFunction) => {

    if (isInternalCall(payload)) {

      abortFunction();

      rejectInternalTask({ manager, payload });

    }

  })

  const holdCall = (payload, hold) => {
    return new Promise((resolve, reject) => {

      const task = payload.task;

      if (isInternalCall(payload)) {

        toggleHoldInternalCall({
          task, manager, hold, resolve, reject
        });

      } else {

        resolve();

      }

    })
  }

  Actions.addListener('beforeHoldCall', (payload) => {
    return holdCall(payload, true)
  })

  Actions.addListener('beforeUnholdCall', (payload) => {
    return holdCall(payload, false)
  })

  Actions.addListener('beforeHoldParticipant', (payload, abortFunction) => {
    const { participantType, targetSid: participantSid, task } = payload;

    if (participantType !== 'unknown') {
      return;
    }

    const { conferenceSid } = task.conference;
    abortFunction();
    console.log('Holding participant', participantSid);
    return ConferenceService.holdParticipant(conferenceSid, participantSid);
  });

  Actions.addListener('beforeUnholdParticipant', (payload, abortFunction) => {
    const { participantType, targetSid: participantSid, task } = payload;

    if (participantType !== 'unknown') {
      return;
    }

    console.log('Holding participant', participantSid);

    const { conferenceSid } = task.conference;
    abortFunction();
    return ConferenceService.unholdParticipant(conferenceSid, participantSid);
  });

  Actions.addListener('beforeKickParticipant', (payload, abortFunction) => {

    const { participantType } = payload;

    if (
      participantType !== "transfer" &&
      participantType !== 'worker'
    ) {

      abortFunction();

      kickExternalTransferParticipant(payload);

    }

  })

  Actions.addListener('beforeHangupCall', async (payload, abortFunction) => {
    const { conference, sid, taskSid } = payload.task;
    const participantsOnHold = (participant) => {
      return participant.onHold == true
    };
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));
    const getLatestConference = taskSid => {
      const updatedTask = StateHelper.getTaskByTaskrouterTaskSid(taskSid)
      return updatedTask.conference
    }

    // check if worker hanging up is last worker on the call
    if (conference.liveWorkerCount === 1) {


      // make sure this operation blocks hanging up the call until 
      // all participants are unhold
      let maxAttempts = 0;
      let updatedConference = getLatestConference(taskSid);
      while (updatedConference.participants.some(participantsOnHold) && maxAttempts < 10) {

        //if so, ensure no other participants are on hold as 
        //no external parties will be able to remove them from being on hold.
        updatedConference.participants.forEach(async (participant) => {
          const { participantType, workerSid, callSid } = participant;
          if (participant.onHold) {
            await Actions.invokeAction("UnholdParticipant", {
              participantType,
              task: payload.task,
              targetSid: participantType === 'worker' ? workerSid : callSid
            });
          }
        });

        await snooze(500);
        maxAttempts++;
        updatedConference = getLatestConference(taskSid);
      }

      // if some participants are still on hold, abort hanging up the call
      if (updatedConference.participants.some(participantsOnHold)) {
        abortFunction();
      }
    }
  })
}