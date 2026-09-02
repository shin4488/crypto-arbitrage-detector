package server

import "sync"

// mailbox はクライアントごとの送信待ちメッセージ置き場。
//
// 同じキー（同じ通貨ペア、同じ機会など）のメッセージは最新のものだけを残す。
// これにより、読み出しが遅いクライアントがいても待ち行列が無限に伸びず、
// 追いついたときには常に最新の状態が届く。キューの長さはキーの種類数で頭打ちになる。
type mailbox struct {
	mu     sync.Mutex
	items  map[string]mail
	order  []string
	signal chan struct{}
}

// mail は送信待ちの1件。
type mail struct {
	seq uint64
	msg any
}

func newMailbox() *mailbox {
	return &mailbox{
		items:  make(map[string]mail),
		signal: make(chan struct{}, 1),
	}
}

// Put はメッセージを置く。同じキーが既にあれば置き換える（順番は最初に置いた位置のまま）。
func (m *mailbox) Put(key string, seq uint64, msg any) {
	m.mu.Lock()
	if _, exists := m.items[key]; !exists {
		m.order = append(m.order, key)
	}
	m.items[key] = mail{seq: seq, msg: msg}
	m.mu.Unlock()

	// 送信ゴルーチンを起こす。既に起こす予定があれば何もしない（容量1のチャネル）。
	select {
	case m.signal <- struct{}{}:
	default:
	}
}

// Drain は溜まっているメッセージを置いた順に取り出し、空にする。
func (m *mailbox) Drain() []mail {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.order) == 0 {
		return nil
	}
	out := make([]mail, 0, len(m.order))
	for _, key := range m.order {
		out = append(out, m.items[key])
		delete(m.items, key)
	}
	m.order = m.order[:0]
	return out
}

// Signal はメッセージが置かれたときに通知されるチャネル。
func (m *mailbox) Signal() <-chan struct{} {
	return m.signal
}
