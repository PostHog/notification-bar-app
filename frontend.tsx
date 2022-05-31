import React, { useEffect, useState } from 'react'
import { api, lemonToast, LemonSwitch, LemonInput, LemonTextArea, LemonButton } from '@posthog/apps-common'

interface FlagVariantPayload {
    message: string
    fixed: boolean
    html: boolean
    color: string
    background: string
}

const defaultKey = 'notification-bar'
const defaultPayload: FlagVariantPayload = {
    message: '',
    color: '#fef6f6',
    background: '#920c0c',
    fixed: true,
    html: false,
}

function NotificationBar({ config }) {
    const flagKey = config.flagKey || defaultKey
    const { payload, enabled, saving, updatePayload, setEnabled, loading, saveChanges } =
        useFlagPersistence<FlagVariantPayload>(flagKey, defaultPayload, 'Managed by the "Notification Bar" app')

    return !loading ? (
        <div>
            <label>Message</label>
            <LemonTextArea value={payload.message} onChange={(message) => updatePayload({ message })} />
            <br />
            <label>Text color</label>
            <LemonInput label="Color" value={payload.color} onChange={(color) => updatePayload({ color })} />
            <br />
            <label>Background color</label>
            <LemonInput
                label="Background"
                value={payload.background}
                onChange={(background) => updatePayload({ background })}
            />
            <br />
            <LemonSwitch label="Enabled" checked={enabled} onChange={setEnabled} />
            <LemonSwitch label="Allow HTML" checked={payload.html} onChange={(html) => updatePayload({ html })} />
            <LemonSwitch
                label="Fixed positioning"
                checked={payload.fixed}
                onChange={(fixed) => updatePayload({ fixed })}
            />
            <br />
            <LemonButton type="primary" onClick={saveChanges} disabled={saving}>
                Save
            </LemonButton>

            <h1 style={{ marginTop: '2rem' }}>One time setup</h1>
            <p>Copy the following code to your site. Try it now with the devtools console.</p>
            <pre>
                {`
posthog.onFeatureFlags((_, flags) => {
    if (!(${JSON.stringify(flagKey)} in flags)) {
        return; 
    }
    try {
        var payload = JSON.parse(atob(flags[${JSON.stringify(flagKey)}].replace(/\_/g, '=').replace(/\-/g, '+')))
        var div = document.createElement('div')
        div.style.color = payload.color || ${JSON.stringify(payload.color)}
        div.style.background = payload.background || ${JSON.stringify(payload.background)}
        div.style.padding = '5px 10px'
        if ("fixed" in payload ? payload.fixed : ${JSON.stringify(payload.fixed)}) {
            div.style.position = 'fixed'
            div.style.top = 0
            div.style.width = '100%'
            div.style.zIndex = 100000
        }
        div.style.cursor = 'pointer'
        div.addEventListener('click', () => div.remove())
        div.${payload.html ? 'innerHTML' : 'innerText'} = payload.message
        document.body.prepend(div)
    } catch (e) {
        console.error("Could not parse notification bar payload: " + message)
        throw e
    }
})
`.trim()}
            </pre>
        </div>
    ) : (
        <div>Loading...</div>
    )
}

export const scene = {
    title: 'Notification Bar',
    component: NotificationBar,
}

// Flag persistence

interface FlagPersistenceHook<Payload> {
    payload: Payload
    setPayload: (payload: Payload) => void
    updatePayload: (payload: Partial<Payload>) => void
    enabled: boolean
    setEnabled: (enabled: boolean) => void
    loading: boolean
    saving: boolean
    saveChanges: () => Promise<void>
}

function useFlagPersistence<Payload = Record<string, any>>(
    flagKey: string,
    defaultPayload: Payload,
    flagDescription: string = 'Managed by an app'
): FlagPersistenceHook<Payload> {
    const [loading, setLoading] = useState(true)
    const [flags, setFlags] = useState([])
    const [flag, setFlag] = useState(null)
    const [enabled, setEnabled] = useState(false)
    const [payload, setPayload] = useState<Payload>(defaultPayload)
    const updatePayload = (values: Partial<Payload>) => setPayload((payload) => ({ ...payload, ...values }))
    const [saving, setSaving] = useState(false)
    function encode(str: string) {
        return btoa(str).replace(/\=/g, '_').replace(/\+/g, '-')
    }
    function decode(str: string) {
        return atob(str.replace(/\_/g, '=').replace(/\-/g, '+'))
    }
    function getCurrentTeamId() {
        return (window as any).POSTHOG_APP_CONTEXT.current_team.id
    }

    function receivedFlag(flag) {
        setFlag(flag)
        setEnabled(flag.active)
        const receivedPayload = decode(flag.filters?.multivariate?.variants?.[0]?.key ?? '')
        if (receivedPayload) {
            try {
                setPayload({ ...defaultPayload, ...JSON.parse(receivedPayload) })
            } catch (error) {
                console.error({ payload, error })
                lemonToast.error(`Could not parse payload: ${payload}`)
            }
        }
    }

    async function saveChanges() {
        setSaving(true)
        try {
            const newFlag = await api.update(`api/projects/${getCurrentTeamId()}/feature_flags/${flag.id}`, {
                name: flagDescription,
                filters: {
                    groups: [
                        {
                            properties: [],
                            rollout_percentage: null,
                        },
                    ],
                    multivariate: {
                        variants: [
                            {
                                key: encode(JSON.stringify(payload)),
                                name: 'automatically generated base64 encoded json with substitutions "=" to "_", "+" to "-"',
                                rollout_percentage: 100,
                            },
                        ],
                    },
                },
                deleted: false,
                active: enabled,
            })
            lemonToast.success('Changes saved!')
            receivedFlag(newFlag)
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        async function fetchData() {
            try {
                // TODO: filter by key?
                const response = await api.get(`api/projects/${getCurrentTeamId()}/feature_flags/`)
                const flags = response.results
                setFlags(flags)
                const flag = flags.find((flag) => flag.key === flagKey)
                if (flag) {
                    receivedFlag(flag)
                } else {
                    const newFlag = await api.create(`api/projects/${getCurrentTeamId()}/feature_flags/`, {
                        key: flagKey,
                        name: 'Managed by the "Notification Bar" app',
                        filters: {
                            groups: [
                                {
                                    properties: [],
                                    rollout_percentage: null,
                                },
                            ],
                            multivariate: {
                                variants: [
                                    {
                                        key: encode(JSON.stringify(defaultPayload)),
                                        name: '',
                                        rollout_percentage: 100,
                                    },
                                ],
                            },
                        },
                        deleted: false,
                        active: false,
                        created_by: null,
                        is_simple_flag: false,
                        rollout_percentage: null,
                    })
                    receivedFlag(newFlag)
                }
                setLoading(false)
            } catch (e) {
                lemonToast.error('Error loading feature flag')
                e.detail && lemonToast.error(e.detail)
            }
        }
        void fetchData()
    }, [])

    return {
        payload,
        setPayload,
        updatePayload,
        enabled,
        setEnabled,
        saving,
        loading,
        saveChanges,
    }
}
