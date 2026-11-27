import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, MoreHorizontal, Share2 } from 'lucide-react';
import type { MeResponse, SiteSettings } from '../types';

interface InvitePageProps {
  me: MeResponse;
  settings: SiteSettings;
}

export const InvitePage: React.FC<InvitePageProps> = ({ me, settings }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const referralCode = me.user.referralCode;
  const referralUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`
      : `https://mahendra94.app/?ref=${encodeURIComponent(referralCode)}`;
  const displayReferralUrl = `https://mahendra94.app/?ref=${encodeURIComponent(referralCode)}`;

  useEffect(() => {
    QRCode.toDataURL(referralUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#0B1D12', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [referralUrl]);

  const copyText = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setCopiedType(null);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${settings.siteName} Invitation`,
          text: `Join ${settings.siteName} using my invite code ${referralCode}`,
          url: referralUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await copyText(referralUrl, 'link');
  };

  const shareText = encodeURIComponent(
    `Join ${settings.siteName} with my referral code ${referralCode}: ${referralUrl}`
  );
  const encodedUrl = encodeURIComponent(referralUrl);

  const commissionLevels = [
    {
      badge: 'LV 1',
      title: 'Direct joins',
      desc: 'People you invite yourself',
      rate: settings.commissionLv1,
    },
    {
      badge: 'LV 2',
      title: 'Second level',
      desc: 'Invited by your Level 1',
      rate: settings.commissionLv2,
    },
    {
      badge: 'LV 3',
      title: 'Third level',
      desc: 'Invited by your Level 2',
      rate: settings.commissionLv3,
    },
  ];

  return (
    <div className="pb-24 lg:pb-10">
      {/* Green Header */}
      <div className="brand-header-gradient text-white pt-5 pb-14 px-4 relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <span className="w-9" />
            <h1 className="font-display font-bold text-lg tracking-tight">Invite &amp; Earn</h1>
            <button
              type="button"
              onClick={handleNativeShare}
              aria-label="Share referral link"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs sm:text-sm text-white/90 font-medium">
            Let your friend scan the code — earn referral rewards on eligible plan activity.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 -mt-9 space-y-4 relative z-10">
        {/* QR Code Card */}
        <div className="bg-white rounded-[24px] card-mint-border p-5 sm:p-6 flex flex-col items-center text-center">
          <div className="p-3 rounded-2xl bg-white border border-[#E1F3E8] shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Referral QR code ${referralCode}`}
                className="w-44 h-44 sm:w-48 sm:h-48"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-xs text-[#6B8275]">
                Generating QR...
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-[#6B8275]">Scan this code to open your invite link</p>
          <button
            type="button"
            onClick={() => copyText(referralCode, 'code')}
            className="mt-2.5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E7F7EE] border border-[#C6EAD4] text-[#005B32] font-mono-num font-bold text-sm hover:bg-[#D8F2E3] transition cursor-pointer"
          >
            {copiedType === 'code' ? (
              <>
                <Check className="w-4 h-4 text-[#008C45]" />
                <span>Copied {referralCode}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#008C45]" />
                <span>{referralCode}</span>
              </>
            )}
          </button>
        </div>

        {/* Referral Link & Social Share Card */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0]">
            <input
              type="text"
              name="mahendra94"
              readOnly
              value={displayReferralUrl}
              aria-label="Unique referral URL"
              className="flex-1 min-w-0 bg-transparent text-xs text-[#4C6356] font-mono-num truncate focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyText(referralUrl, 'link')}
              className="px-4 py-2 rounded-xl brand-gradient text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            >
              {copiedType === 'link' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#E5F3EB]" />
            <span className="text-[11px] font-medium text-[#7B9184]">Share via</span>
            <span className="h-px flex-1 bg-[#E5F3EB]" />
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-11 h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center font-display font-bold text-sm shadow-sm group-hover:scale-105 transition">
                WA
              </div>
              <span className="text-[11px] text-[#4C6356] font-medium">WhatsApp</span>
            </a>

            <a
              href={`https://t.me/share/url?url=${encodedUrl}&text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-11 h-11 rounded-full bg-[#229ED9] text-white flex items-center justify-center font-display font-bold text-sm shadow-sm group-hover:scale-105 transition">
                TG
              </div>
              <span className="text-[11px] text-[#4C6356] font-medium">Telegram</span>
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-11 h-11 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-display font-extrabold text-base shadow-sm group-hover:scale-105 transition">
                f
              </div>
              <span className="text-[11px] text-[#4C6356] font-medium">Facebook</span>
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-11 h-11 rounded-full bg-[#14171A] text-white flex items-center justify-center font-display font-bold text-base shadow-sm group-hover:scale-105 transition">
                𝕏
              </div>
              <span className="text-[11px] text-[#4C6356] font-medium">Twitter</span>
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-[#E7F7EE] text-[#008C45] flex items-center justify-center shadow-sm group-hover:scale-105 transition">
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-[#4C6356] font-medium">More</span>
            </button>
          </div>
        </div>

        {/* Commission Levels */}
        <div>
          <h2 className="text-xs font-extrabold tracking-wider uppercase text-[#FFD970] mb-2 px-1">
            Commission Levels
          </h2>
          <div className="bg-white rounded-[24px] card-mint-border divide-y divide-[#EDF7F1]">
            {commissionLevels.map((lv) => (
              <div key={lv.badge} className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-9 rounded-xl bg-[#E7F7EE] text-[#007A3D] font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                    {lv.badge}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-[#17231C]">{lv.title}</div>
                    <div className="text-xs text-[#6D8377] truncate">{lv.desc}</div>
                  </div>
                </div>
                <div className="font-display font-extrabold text-xl text-[#008C45] tabular-nums shrink-0">
                  {lv.rate}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div>
          <h2 className="text-xs font-extrabold tracking-wider uppercase text-[#FFD970] mb-2 px-1">
            How It Works
          </h2>
          <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-4">
            {[
              {
                step: 1,
                title: 'Share your referral code or link',
                desc: 'Let friends scan the QR code or open your invite URL directly.',
              },
              {
                step: 2,
                title: 'They register and activate an eligible plan',
                desc: 'Your friend signs up with your code and activates a surface portfolio.',
              },
              {
                step: 3,
                title: 'Receive applicable referral rewards',
                desc: 'Rewards are calculated server-side according to transparent 3-level rules.',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#E7F7EE] text-[#008C45] font-display font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </span>
                <div>
                  <div className="font-display font-bold text-sm text-[#17231C]">{item.title}</div>
                  <div className="text-xs text-[#6B8275] mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
