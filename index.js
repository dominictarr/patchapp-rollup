var ms = require('markdown-summary')
var pull = require('pull-stream')
var h = require('hyperscript')
var ssbThread = require('ssb-thread')
var markdown = require('ssb-markdown')
var More = require('pull-more')
var HyperMoreStream = require('hyperloadmore/stream')


exports.gives = {
  app: { view: true, menu: true}
}

exports.needs = {
  sbot: { createLogStream: 'first', get: 'first', links: 'first' },
  message: { layout: 'first' },
  avatar: { name: 'first', image: 'first' }
}

exports.create = function (api) {
  return {app: { view: function (src) {
    if(src !== 'public') return
    var content = h('div.rollup')

    var threads = {}
    var getThread = ssbThread.bind(null, api.sbot, function (m) {
      return m
    })

    function mkdn(src) {
    return h('div.markdown',
      {innerHTML: markdown.block(src, {toUrl: function (url, image) {
        if(!image) return url
        if(url[0] !== '&') return url
        return 'http://localhost:8989/blobs/get/'+url
      }})}
    )

    }

    function renderThread (data) {
      var root = data.value.content.root || data.key
      if(threads[root]) return
      threads[root] = true
      var t = h('div.thread')
      getThread(root, function (thread) {
        t.innerHTML = ''
        t.appendChild(h('div.thread',
          h('div.side',
            h('div.Avatar',
              h('a', {href: data.value.author},
                api.avatar.image(data.value.author)
              ),
              h('a', {href: data.value.author},
                api.avatar.name(data.value.author)
              )
            )
          ),
          h('div.message__wrapper',
            h('h3', mkdn(ms.title(thread[0].value.content.text))),
            mkdn(ms.summary(thread[0].value.content.text))
          ),
          h('a', {href: root}, 'view full thread('+thread.length+')'),
          h('hr'),
          thread.length > 1 ?
          h('div.message__wrapper',
            mkdn(
              ms.title(thread[thread.length-1].value.content.text)
              +'\n'+
              ms.summary(thread[thread.length-1].value.content.text))
          )

          : h('p', 'new thread') //reply button?
        ))
      })

      return t
    }

    function createStream (opts) {
      return pull(
        (id
          ? More(api.sbot.createUserStream, opts, ['value', 'sequence'])
          : More(api.sbot.createLogStream, opts)
        ),
        pull.filter(function (data) {
          return 'string' === typeof data.value.content.text
        }),
        pull.map(renderThread),
        pull.filter(Boolean)
      )
    }

    var id = null

    pull(
      createStream({old: false, limit: 100, id: id}),
      HyperMoreStream.top(content)
    )

    pull(
      createStream({reverse: true, live: false, limit: 100, id: id}),
      HyperMoreStream.bottom(content)
    )

    return content
  },
    menu: function () {
      return 'public'
    }
  }}

}

