package logger

import (
	"fmt"
	"time"

	loggercolor "ascendant/backend/internal/infra/logger/color"

	"github.com/google/uuid"
)

type (
	EventType   string
	EventLevel  string
	EventResult string
	ActorType   string
)

func (e EventType) String() string {
	return string(e)
}

func (e EventLevel) String() string {
	return string(e)
}

func (e EventResult) String() string {
	return string(e)
}

func (e ActorType) String() string {
	return string(e)
}

type EventActor struct {
	Type ActorType
	ID   uint
}

// Event levels
const (
	InfoL  EventLevel = "Info"
	WarnL  EventLevel = "Warn"
	ErrorL EventLevel = "Error"
	DebugL EventLevel = "Debug"
)

// Event results
const (
	Success EventResult = "success"
	None    EventResult = "-"
	Failure EventResult = "failure"
)

// Actor types
const (
	User      ActorType = "User"
	System    ActorType = "System"
	Scheduler ActorType = "Scheduler"
)

type Event struct {
	ID      uuid.UUID
	At      time.Time
	Type    EventType
	Level   EventLevel
	Message string
	Actor   EventActor
	TraceID string
	Result  EventResult
}

const timeLayout = "2006-01-02 15:04:05"

func buildLog(eventType EventType, level EventLevel, message string, actor EventActor, result EventResult, trace ...string) Event {
	traceID := ""
	if len(trace) > 0 {
		traceID = trace[0]
	}

	return Event{
		At:      time.Now(),
		Type:    eventType,
		Level:   level,
		Message: message,
		Actor:   actor,
		TraceID: traceID,
		Result:  result,
	}
}

func actorString(a EventActor) string {
	if a.Type == "" {
		return "-"
	}
	if a.ID == 0 {
		return string(a.Type)
	}
	return fmt.Sprintf("%s:%d", a.Type, a.ID)
}

func levelPrefix(level EventLevel) (text, hex string) {
	switch level {
	case WarnL:
		return "[WARNING]:", "#b0a50e"
	case ErrorL:
		return "[ERROR]:", "#660818"
	case DebugL:
		return "[DEBUG]:", "#ffffff"
	default:
		return "[INFO]:", "#03ab09"
	}
}

func printEvent(e Event) {
	prefix, hex := levelPrefix(e.Level)
	ts := e.At.Format(timeLayout)
	who := actorString(e.Actor)

	fmt.Printf("%s %s %s | %s\n",
		loggercolor.ColorHEX(prefix, hex),
		who,
		e.Message,
		ts,
	)
}

func Info(message, event string, actor EventActor, result EventResult, trace ...string) Event {
	e := buildLog(EventType(event), InfoL, message, actor, result, trace...)
	printEvent(e)
	return e
}

func Warning(message, event string, actor EventActor, result EventResult, trace ...string) Event {
	e := buildLog(EventType(event), WarnL, message, actor, result, trace...)
	printEvent(e)
	return e
}

func Error(message, event string, actor EventActor, result EventResult, trace ...string) Event {
	e := buildLog(EventType(event), ErrorL, message, actor, result, trace...)
	printEvent(e)
	return e
}

func Debug(message, event string, trace ...string) Event {
	e := buildLog(EventType(event), DebugL, message, EventActor{Type: System}, None, trace...)
	printEvent(e)
	return e
}
