import React, { useState } from 'react';

export const MeetingInfoBar = ({ roomId, meetingTitle, hostName, participantCount }) => {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between text-white">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-base font-semibold leading-tight">{meetingTitle || 'WebRTC Active Session'}</h2>
          <p className="text-xs text-gray-400">Host: {hostName || 'Organizer'} | Room ID: {roomId}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="bg-emerald-950 border border-emerald-600/40 text-emerald-400 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Live ({participantCount})
        </span>

        <button
          onClick={copyLink}
          className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1.5 rounded-lg border border-gray-700 transition">
          {copied ? '✓ Link Copied' : '📋 Copy Invitation'}
        </button>
      </div>
    </div>
  );
};