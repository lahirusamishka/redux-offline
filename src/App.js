import 'modern-normalize'
import React, { Component, Fragment } from 'react'
import 'regenerator-runtime'
import styled from 'styled-components'
import { createStore, applyMiddleware, compose } from 'redux'
import { Provider, connect } from 'react-redux'
import { offline } from '@redux-offline/redux-offline'
import offlineConfig from '@redux-offline/redux-offline/lib/defaults'
import { ObjectInspector } from 'react-inspector'
import Spinner from 'react-svg-spinner'
import produce from 'immer'

const { random } = Math

const makeId = () =>
  Math.random()
    .toString(32)
    .slice(2, 6)

const effect = ({ json }) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (random() > 0.5) {
        resolve(json)
      } else {
        reject({ error: 'Foo' })
      }
    }, random() * 1000)
  })

const increaseAmount = ({ itemId }) => ({
  type: 'INCREASE_AMOUNT',
  payload: { itemId },
  meta: {
    offline: {
      // the network action to execute:
      effect: { url: '/api/increase-amount', method: 'POST', json: { itemId } },
      // action to dispatch if network action fails permanently:
      rollback: { type: 'INCREASE_AMOUNT_ROLLBACK', meta: { itemId } },
    },
  },
})

const addItem = ({ itemId = makeId(), amount = 1 } = {}) => ({
  type: 'ADD_ITEM',
  payload: { itemId, amount },
  meta: {
    offline: {
      // the network action to execute:
      effect: {
        url: '/api/add-item',
        method: 'POST',
        json: { itemId, amount },
      },
      // action to dispatch when effect succeeds:
      commit: { type: 'ADD_ITEM_COMMIT', meta: { itemId } },
      // action to dispatch if network action fails permanently:
      rollback: { type: 'ADD_ITEM_ROLLBACK', meta: { itemId } },
    },
  },
})

const reducer = (
  state = {
    items: {
      [makeId()]: { amount: 10 },
      [makeId()]: { amount: 20 },
    },
  },
  action
) =>
  produce(state, draft => {
    switch (action.type) {
      case 'INCREASE_AMOUNT': {
        draft.items[action.payload.itemId].amount += 10
        break
      }
      case 'INCREASE_AMOUNT_ROLLBACK': {
        draft.items[action.meta.itemId].amount -= 10
        break
      }

      case 'ADD_ITEM': {
        draft.items[action.payload.itemId] = {
          pending: true,
          amount: action.payload.amount,
        }
        break
      }
      case 'ADD_ITEM_COMMIT': {
        delete draft.items[action.meta.itemId].pending
        delete draft.items[action.meta.itemId].error
        break
      }
      case 'ADD_ITEM_ROLLBACK': {
        draft.items[action.meta.itemId].error = true
        break
      }
    }
  })

const logger = store => next => action => {
  console.log('[action]', action)
  return next(action)
}

let toggleNetworkStatus
const store = createStore(
  reducer,
  compose(
    offline({
      ...offlineConfig,
      persist: false,
      effect,
      detectNetwork: callback => {
        toggleNetworkStatus = callback
        callback(false)
      },
    }),
    applyMiddleware(logger)
  )
)

const StoreState = connect(state => ({
  name: 'store',
  data: state,
  expandLevel: 4,
}))(ObjectInspector)

const PendingActions = connect(state => ({
  children: `${state.offline.outbox.length} pending ${state.offline.outbox.length === 0 || state.offline.outbox.length > 1
    ? 'actions'
    : 'action'
    }`,
}))(
  styled.div({
    margin: 5,
  })
)

const Box = styled.div({
  border: '1px solid #000',
  padding: 10,
  margin: 10,
})

const Flex = styled.div({
  display: 'flex',
  flexDirection: 'column',
})

const FlexItem = styled.div({
  flexGrow: 1,
})

const Items = connect(
  state => ({
    items: Object.entries(state.items),
  }),
  { increaseAmount, addItem }
)(({ items, increaseAmount, addItem }) => (
  <Box>
    <div>Items</div>
    <ul>
      {items.map(([itemId, { amount, pending, error }]) => (
        <li key={itemId} style={{ color: error && 'red' }}>
          {amount}{' '}
          {error && <button onClick={() => addItem({ itemId })}>retry</button>}
          {!pending && (
            <button onClick={() => increaseAmount({ itemId })}>+</button>
          )}
        </li>
      ))}
    </ul>
    <button onClick={() => addItem()}>addItem</button>
  </Box>
))

const NetworkStatus = connect(state => ({
  isOnline: state.offline.online,
  isBusy: state.offline.busy,
}))(({ isOnline, isBusy }) => (
  <Box>
    <div>NetworkStatus</div>
    <button
      onClick={() => toggleNetworkStatus(!isOnline)}
      style={{
        height: 30,
        borderRadius: 30,
        border: 'none',
        padding: '3px 10px',
        color: '#fff',
        backgroundColor: isOnline ? 'green' : 'red',
      }}
    >
      {isOnline ? 'online' : 'offline'}{' '}
      {isBusy && <Spinner color="white" thickness={5} />}
    </button>

    <PendingActions />
  </Box>
))

class App extends Component {
  render() {
    return (
      <Provider store={store}>

        <Flex style={{ width: '100vw', height: '100vh' }}>
          <FlexItem grow={1} style={{ padding: 20 }}>
            <NetworkStatus />
            <Items />
          </FlexItem>
          <FlexItem noShrink style={{ padding: 20 }}>
            <StoreState />
          </FlexItem>
        </Flex>
      </Provider>
    )
  }
}

export default App;
