import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { listsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import type { ListDetail } from '../types';

interface Props {
  list: ListDetail;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void;
  onNotice: (message: string, ok: boolean) => void;
}

export function ShareModal({ list, currentUserId, onClose, onChanged, onNotice }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = list.ownerId === currentUserId;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await listsApi.share(list.id, email.trim().toLowerCase());
      setEmail('');
      onNotice(t('share.shared', { email: email.trim().toLowerCase() }), true);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('share.failed'));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await listsApi.removeMember(list.id, userId);
      onNotice(t('share.removed'), true);
      onChanged();
    } catch (err) {
      onNotice(err instanceof ApiError ? err.message : t('share.removeFailed'), false);
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" data-testid="share-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{t('share.title', { name: list.name })}</h5>
              <button
                type="button"
                className="btn-close"
                aria-label={t('common.close')}
                onClick={onClose}
                data-testid="share-modal-close"
              />
            </div>

            <div className="modal-body">
              {isOwner ? (
                <form onSubmit={submit} className="mb-3" data-testid="share-form">
                  <label className="form-label small" htmlFor="share-email">
                    {t('share.emailLabel')}
                  </label>
                  <div className="input-group">
                    <input
                      id="share-email"
                      type="email"
                      className="form-control"
                      placeholder={t('share.placeholder')}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      data-testid="share-email-input"
                      autoComplete="off"
                    />
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={saving || !email.trim()}
                      data-testid="share-submit"
                    >
                      {saving ? t('share.submitting') : t('share.submit')}
                    </button>
                  </div>
                  {error && (
                    <div className="alert alert-danger py-2 mt-2 mb-0 small" data-testid="share-error">
                      {error}
                    </div>
                  )}
                </form>
              ) : (
                <p className="text-muted small">
                  {t('share.ownerOnly')}
                </p>
              )}

              <h6 className="lc-divider-label mb-2">{t('share.members', { count: list.members.length })}</h6>
              <ul className="list-group list-group-flush" data-testid="member-list">
                {list.members.map((member) => (
                  <li
                    key={member.id}
                    className="list-group-item d-flex align-items-center gap-2 px-0"
                    data-testid="member-row"
                    data-member-email={member.email}
                  >
                    <span className="lc-avatar">
                      {member.fullName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex-grow-1 min-w-0">
                      <div className="text-truncate">{member.fullName}</div>
                      <div className="text-muted small text-truncate">{member.email}</div>
                    </div>
                    <span className="badge text-bg-light border text-capitalize">{t(`roles.${member.role}`)}</span>
                    {isOwner && member.role !== 'owner' && (
                      <button
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => removeMember(member.userId)}
                        aria-label={t('share.remove', { name: member.fullName })}
                        data-testid="member-remove"
                      >
                        <i className="bi bi-person-dash" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
