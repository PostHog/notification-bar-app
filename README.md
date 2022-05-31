# The Official PostHog Notification Bar App

## !! FOR DEMONSTRATION PURPOSES ONLY !!

This repo is a trial run of a PostHog frontend app.

It's using feature flags for persistence, taking advantage of multivariate support to send a base64-encoded JSON to the user as a variant key.

[Read more here](https://github.com/PostHog/posthog/issues/9479#issuecomment-1141800119)

![2022-05-30 15 50 09](https://user-images.githubusercontent.com/53387/171115224-ec7f96e8-a567-43cd-9656-42ec060486bc.gif)

![image](https://user-images.githubusercontent.com/53387/171165841-bc8a64b5-1b1a-4c7f-aac1-25dcb0675bcb.png)

### One time setup

The app will give you code to copy/paste into your frontend. Obviously feel free to customise this to your needs.

Here's a sample:

```ts
posthog.onFeatureFlags((_, flags) => {
    if (!("notification-bar" in flags)) {
        return; 
    }
    try {
        var payload = JSON.parse(atob(flags["notification-bar"].replace(/_/g, '=').replace(/-/g, '+')))
        var div = document.createElement('div')
        div.style.color = payload.color || "#fef6f6"
        div.style.background = payload.background || "#920c0c"
        div.style.padding = '5px 10px'
        if ("fixed" in payload ? payload.fixed : true) {
            div.style.position = 'fixed'
            div.style.top = 0
            div.style.width = '100%'
            div.style.zIndex = 100000
        }
        div.style.cursor = 'pointer'
        div.addEventListener('click', () => div.remove())
        div.innerText = payload.message
        document.body.prepend(div)
    } catch (e) {
        console.error("Could not parse notification bar payload: " + message)
        throw e
    }
})
```