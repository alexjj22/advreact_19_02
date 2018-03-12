import {all, takeEvery, take, put, apply, call, event, spawn} from 'redux-saga/effects'
import { eventChannel, END } from 'redux-saga'
import {appName} from '../config'
import {createSelector} from 'reselect'
import {Record} from 'immutable'
import firebase from 'firebase'
import {replace} from 'react-router-redux'

/**
 * Constants
 * */
export const moduleName = 'auth'
const prefix = `${appName}/${moduleName}`

export const SIGN_IN_REQUEST = `${prefix}/SIGN_IN_REQUEST`
export const SIGN_IN_START = `${prefix}/SIGN_IN_START`
export const SIGN_IN_SUCCESS = `${prefix}/SIGN_IN_SUCCESS`
export const SIGN_IN_ERROR = `${prefix}/SIGN_IN_ERROR`

export const SIGN_UP_REQUEST = `${prefix}/SIGN_UP_REQUEST`
export const SIGN_UP_START = `${prefix}/SIGN_UP_START`
export const SIGN_UP_SUCCESS = `${prefix}/SIGN_UP_SUCCESS`
export const SIGN_UP_ERROR = `${prefix}/SIGN_UP_ERROR`

export const SIGN_OUT = `${prefix}/SIGN_OUT`
/**
 * Reducer
 * */
export const ReducerRecord = Record({
    user: null,
    loading: false,
    error: null
})

export default function reducer(state = new ReducerRecord(), action) {
    const {type, payload} = action

    switch (type) {
        case SIGN_IN_START:
        case SIGN_UP_START:
            return state
                .set('error', null)
                .set('loading', true)

        case SIGN_IN_SUCCESS:
        case SIGN_UP_SUCCESS:
            return state
                .set('loading', false)
                .set('user', payload.user)

        case SIGN_IN_ERROR:
        case SIGN_UP_ERROR:
            return state
                .set('loading', false)
                .set('error', payload.error.message)

        default:
            return state
    }
}

/**
 * Selectors
 * */

export const stateSelector = state => state[moduleName]
export const userSelector = createSelector(stateSelector, state => state.user)
export const errorSelector = createSelector(stateSelector, state => state.error)
export const loadingSelector = createSelector(stateSelector, state => state.loading)

/**
 * Action Creators
 * */

export function signIn(email, password) {
    return {
        type: SIGN_IN_REQUEST,
        payload: { email, password }
    }
}

export function signUp(email, password) {
    return {
        type: SIGN_UP_REQUEST,
        payload: { email, password }
    }
}

//firebase.auth().onAuthStateChanged(user => {
//    if (user) window.store.dispatch({
//        type: SIGN_IN_SUCCESS,
//        payload: { user }
//    })
//})

/**
 * Sagas
 */

export const signUpSaga = function * () {
    while (true) {
        const action = yield take(SIGN_UP_REQUEST)
        const {email, password} = action.payload

        yield put({
            type: SIGN_UP_START
        })

        try {
            const auth = firebase.auth()
            yield call([auth, auth.createUserWithEmailAndPassword], email, password)
        } catch (error) {
            yield put({
                type: SIGN_UP_ERROR,
                payload: {error}
            })
        }
    }
}

export const signInSaga = function * (action) {
    const { email, password } = action.payload

    yield put({
        type: SIGN_IN_START
    })

    try {
        const auth = firebase.auth()
        yield apply(auth, auth.signInWithEmailAndPassword, [email, password])
    } catch (error) {
        yield put({
            type: SIGN_IN_ERROR,
            payload: { error }
        })
    }
}

export function * watchStatusChangeSaga() {
    while (true) {
        yield take(SIGN_IN_SUCCESS)

        yield (put(replace('/people')))
    }
}

export function * watchSignOutSaga() {
    while (true) {
        yield take(SIGN_OUT)

        yield (put(replace('/auth/sign-in')))
    }
}

const authStatusSaga = () => eventChannel(
    emit => {
        const callback = user => emit({ user });

        firebase.auth().onAuthStateChanged( callback )

        return () => { };
        // для прекращения саги правильно ли () => emit(END)
    }
)

export function * watchAuth() {
    const channel = yield call(authStatusSaga)

    try {
        while (true) {
            const { user } = yield take(channel)

            if( user ) {
                yield put({
                    type: SIGN_IN_SUCCESS,
                    payload: { user }
                })
            } else {
                yield put({
                    type: SIGN_OUT
                })
            }
        }
    } finally {
        console.log('watchAuth terminated')
    }
}

export const saga = function * () {
    yield spawn(watchAuth)

    yield all([
        takeEvery(SIGN_IN_REQUEST, signInSaga),
        signUpSaga(),
        watchStatusChangeSaga(),
        watchSignOutSaga()
    ])
}