// Order labels: the mapping from a stored status/action token to its copy.
//
// The panels used to build their keys by interpolation - `t(`status_${status}`)`
// - and no such key exists in either dictionary. t() returns the template's own
// text on a miss, so every status pill, tab, history row and action button was
// rendering `status_pending` / `action_confirm` to the owner. The copy was
// already written, under different names; this is the one place that knows
// which, and both OrdersPage and OverviewPage read it from here so they cannot
// drift apart.

const STATUS_KEY = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  shipped: 'statusShipped',
  delivered: 'statusDelivered',
  cancelled: 'statusCancelled',
  returned: 'statusReturned'
}

const ACTION_KEY = {
  confirm: 'confirmForShipping',
  ship: 'markShipped',
  deliver: 'markDelivered',
  return: 'markReturned',
  cancel: 'cancelOrder'
}

/**
 * Translate an order status.
 *
 * A status this build has never seen falls back to the raw token, which is the
 * one case where showing the value beats showing an empty pill.
 */
export function orderStatusLabel(t, status) {
  return t(STATUS_KEY[status] ?? status)
}

/** Translate a lifecycle action offered on a status. */
export function orderActionLabel(t, action) {
  return t(ACTION_KEY[action] ?? action)
}