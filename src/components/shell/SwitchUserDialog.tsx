import { Avatar, Button, Dialog, Mono } from '../ui';
import { useStore } from '../../store/StoreContext';
import { depth, managerChain } from '../../domain/org';

/** There is no auth in v1 (see decisions.md Q8), so identity is a switch rather than a
 *  login. It doubles as the fastest way to see the tree's permission rule at work: sign
 *  in as someone lower down and the surfaces above them disappear. */
export function SwitchUserDialog({ onClose }: { onClose: () => void }) {
  const { state, me, dispatch } = useStore();
  const members = Object.values(state.users).sort(
    (a, b) => depth(state, a.id) - depth(state, b.id) || a.name.localeCompare(b.name),
  );

  return (
    <Dialog title="Signed in as" onClose={onClose}>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
        You see the tasks of anyone below you in the tree, and nobody sideways or above.
        Switch member to see the product from their place in it.
      </p>
      <div className="rows">
        {members.map((u) => {
          const chain = managerChain(state, u.id);
          const manager = chain[chain.length - 1];
          return (
            <div className="row" key={u.id} onClick={() => { dispatch({ type: 'session/switch-user', userId: u.id }); onClose(); }}>
              <Avatar user={u} size="sm" decorative />
              <span className="row-main">
                <span className="row-title">{u.name}</span>
                <span className="row-sub">
                  {u.role}
                  {manager && ` · Reports to ${manager.name}`}
                </span>
              </span>
              <Mono className="faint">{u.handle}</Mono>
              {u.id === me.id && <span className="badge">Signed in</span>}
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
