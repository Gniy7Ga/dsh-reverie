/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/NativeConversation.jsx
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Copied verbatim.
 * See NOTICE.md for details.
 */
/** Harness's own conversation, composer, model picker and tool/approval UI. */
function ChatView({renderSlot}) { return renderSlot('conversation.session',{view:'chat'}); }
export function NativeConversation({sessionId,useSession,useConversation,useSessions,renderFactorySlot}) {
  const session=useSession(s=>s);
  const conversation=useConversation(s=>s);
  const blank=useSessions(s=>s.byId[sessionId]?.blank);
  const active=conversation.activeTargets.size>0 || (!session.blank&&!session.awaitingFirstTurn) || session.running;
  const settling=!active && session.openState==='loading' && blank!==true;
  const hero=!active && (session.openState==='open'||blank===true);
  return renderFactorySlot('conversation.content',{variant:'embedded',phase:settling?'settling':hero?'hero':'active',hero},{slots:{views:ChatView}});
}
